# AI 마에스트로 RAG 개선 계획 (검토·계획용)

> 상태: **계획(일부 구현됨)** · 최초 2026-06-24 · **개정 2026-06-29(현재 서비스 정합)**

## 결정사항 (2026-06-29 확정)
- **챗 엔진**: **Gemini 유지**(`@google/genai`, `GEMINI_MODEL`=`gemini-3.1-flash-lite`). 임베딩도 Gemini(`gemini-embedding-001`, 1024dim)로 통합 — Voyage 제거. → 문서·메모리 정정.
- **코퍼스 범위**: **기사(Article) + 발행 매거진 전체(MagazinePage 블록 텍스트) + 문화예술(CultureEvent)**. 블로그 제외.
- **저장 구조**: **통합 `ContentChunk`**(sourceType article/magazine/culture + sourceId) 단일 테이블. 소스별 테이블 미사용(현재 청크 0건이라 무손실 전환). `BlogPostChunk`는 물리 보존하되 검색·색인에서 제외.
- **매거진 중복 방지**: 페이지에 `articleId` 연결이 있으면 그 텍스트는 기사 청크로 커버 → 매거진 청크에서 제외. 비연결 페이지 텍스트만 매거진 소스로 색인.
- **문화예술**: 구조화 도구 `get_culture_events`(목록/사실)는 유지 + 서술형 질의 대응을 위해 의미검색에도 색인(설명·아티스트·장르).

## 0. 서비스 범위 (전제)

**블로그는 서비스에서 제외됨.** 공개 콘텐츠는 **기사(`/articles`) + 매거진(`/magazines`)** 중심
(+ 문화예술·티켓 등). `BlogPost`는 공개 라우트 없음(어드민 업로드 API 잔재만), 데이터 0건.
따라서 **RAG 코퍼스 = `Article`(본문) + `Magazine` 페이지 블록 텍스트**. 블로그는 색인·검색 대상이 아니다.

도메인 원칙([[article-magazine-merge]]): **Article = 모든 기사의 단일 원천이자 RAG 1급 시민.**
매거진 편집본 텍스트는 구성형 `MagazinePage.layout` 블록에 저장 → 별도 색인 대상.

## 1. 현재 상태 (2026-06-29 실측)

### 구현된 것 (문서 최초 작성 이후 진척)
- `ArticleChunk` 테이블 + `generateArticleEmbeddings()`(Article 본문 → 청크) ✅
- `searchChunks()` — 청크 검색(유사도>0.3, topK 5) ✅
- **기사 발행 시 임베딩 자동 트리거** — `article-actions`에서 `generateArticleEmbeddings` fire-and-forget ✅
- `Article.embeddingStatus`(enum none/…) 스키마 존재 ✅ (A2 일부)
- 재색인 라우트 `/api/admin/backfill-embeddings` 존재 ⚠️ (아래 결함)

### 운영 데이터 (실측)
```
ArticleChunk: 0      BlogPostChunk: 0
Article:   published+aiIndexable 1건 / draft+aiIndexable 10건
Magazine:  published 39건  (텍스트 미색인)
BlogPost:  0건 (서비스 제외)
```

### 결함·불일치 (수정 대상)
1. **backfill 라우트가 블로그만 대상** (`BlogPost where published` → `generateEmbeddings`). 기사·매거진을 못 채움 → 발행 기사 1건도 청크 0. **헛도는 엔드포인트.**
2. **`searchChunks`가 `BlogPostChunk`를 여전히 조회** — 블로그 제외이므로 죽은 쿼리(불필요한 비용·혼선).
3. **발행 기사 1건이 미색인** — 발행 트리거가 있는데 청크 0 → 트리거 이전 발행분이거나 임베딩 실패(Voyage 키/레이트). 백필·상태추적로 가시화 필요.
4. **매거진 39건 텍스트가 검색 대상 아님** — 사실상 주력 콘텐츠인데 답변 근거에 안 들어감(C1 미착수).
5. **엔진 문서 불일치** — 코드는 **Gemini**(`@google/genai`, `gemini-3.1-flash-lite`, `GEMINI_MODEL`), 임베딩만 Voyage. CLAUDE.md/메모리는 "Claude 도슨트 + ANTHROPIC_API_KEY"로 오기재.

**결론(변함없음):** 알고리즘이 아니라 **코퍼스가 비어 있는 게** 핵심. 단, 원인은 "블로그 색인"이 아니라
**(a) 기사 백필 부재 + (b) 매거진 텍스트 미색인 + (c) 블로그 잔재 코드**로 재정의된다.

## 2. 유사 서비스 RAG 운영 패턴 (참고)
- **인덱싱**: 발행 트리거 + **전체 재색인(backfill)** 둘 다, 상태 추적(pending/processing/done/failed), 큐/크론.
- **청킹**: 헤딩 인지 + 오버랩 + 청크에 제목/장르/유형 프리픽스(검색 정확도↑).
- **검색**: 하이브리드(벡터+키워드) → 리랭킹(Voyage `rerank-2` 등) → MMR 다양성, 메타데이터 필터.
- **질의**: 멀티턴을 standalone 질의로 재작성, 멀티쿼리/HyDE.
- **그라운딩**: 검색 컨텍스트 한정 답변 + 인용 매핑, 근거 없으면 "모른다".
- **평가/관측**: 검색 적중률·groundedness 로깅(`apiCallLog.sourceCount` 일부 존재).

## 3. 개선 계획 (티어 · 현재 서비스 기준)

### Tier A — RAG를 "작동"시키기 (데이터/파이프라인) · 최우선
- **A0. 블로그 잔재 제거** — `searchChunks`의 BlogPostChunk 분기 삭제, backfill 라우트를 기사 대상으로 전환(또는 폐기). (`BlogPostChunk` 물리 테이블은 [[stage-db-drift]] 따라 보존, 코드 참조만 정리)
- **A1. 기사 재색인(backfill)** — 발행 + `aiIndexable` 기사 전체를 일괄 `generateArticleEmbeddings`. (발행 클릭 의존 제거, 과거/실패분 보강) Voyage 레이트 한도 준수.
- **A2. 색인 상태 추적 마감** — `Article.embeddingStatus`를 임베딩 시작/완료/실패에 맞춰 실제 갱신 + 어드민 표시·재시도 버튼.
- **A3. 코퍼스 확보** — 발행 기사 1건부터 색인 동작 확인. draft 10건 중 답변 대상은 발행 전환 검토.

### Tier C — 매거진 텍스트 색인 (주력 콘텐츠 · A 다음 우선) ※순서 상향
> 발행 매거진이 39건으로 주력이므로, 종전 C1을 **B(품질)보다 먼저** 끌어올린다.
- **C1. 매거진 페이지 블록 텍스트 색인** — 구성형 `MagazinePage.layout`에서 텍스트 블록 추출 → 매거진 출처 청크(기사와 별개 소스). `searchChunks`에 매거진 소스 통합.
  - 단, 39호 본문은 이미 Article로 이전된 경우([[article-magazine-merge]] 상황 2)가 있어 **중복 색인 방지** 필요(페이지가 기사와 연결되어 있으면 기사 청크로 커버, 비연결 페이지 텍스트만 매거진 청크).
- **C2. 그라운딩 강화** — 컨텍스트 한정 답변 + 인용 번호 매핑, 근거 없으면 솔직히(SYSTEM_PROMPT 보강).
- **C3. 정보 없음 UX** — 빈 결과 시 관련 기사/추천 질문 제시.

### Tier B — 검색 품질
- **B1. 리랭킹**(Voyage rerank): 벡터 top-N(20) → rerank → top-5.
- **B2. 하이브리드 검색**: pgvector + Postgres full-text(한국어 `pg_trgm` 보조).
- **B3. 청킹 개선**: 헤딩 인지 + 오버랩 + 청크에 제목/장르/유형 프리픽스.
- **B4. 임계값·topK 튜닝**: 현 `sim>0.3, topK 5` 재조정 + MMR.
- **B5. 멀티턴 질의 재작성**.

### Tier D — 확장(선택)
- 관리형 벡터스토어/AI Gateway 이전, 평가셋·자동 eval, 오디오 개요, 개인화.

## 4. 권장 순서 / 즉시 액션
1. **A0+A1+A2** — 블로그 잔재 정리하고 기사 백필·상태추적로 "기사 근거 답변" 작동.
2. **C1** — 매거진 텍스트 색인으로 주력 콘텐츠 답변 지원(원요구 충족). 기사 연결분 중복 방지.
3. 동작 확인 후 **B1(리랭킹)+B3(청킹)** 로 품질 상향.
4. **문서 정합성** — CLAUDE.md/메모리의 "Claude 도슨트 + ANTHROPIC_API_KEY" → **Gemini(`GEMINI_MODEL`) + 임베딩 Voyage** 로 정정. (또는 엔진을 Claude로 되돌릴지 결정 — §5)

## 5. 확인 필요(결정 대기)
- **챗 엔진 확정**: 현행 **Gemini 유지** vs **Claude 전환**(프로젝트 기조는 Claude 우선이나 코드는 Gemini). 문서/메모리는 이 결정에 맞춰 정정.
- **매거진 색인 범위**: 모든 발행 매거진 vs 특정 호. 기사 연결 페이지의 중복 처리 방식(기사 우선 권장).
- **draft 기사 10건**: 답변 대상으로 발행 전환할지(미발행은 색인 제외 유지).
- **리랭킹·하이브리드까지** 갈지(비용/복잡도) vs Tier A+C1로 충분한지.
