# 기사·매거진 모델 정리 설계 (확정 β)

> 상태: **확정(실행 대기)** · 작성 2026-06-24

## 0. 확정된 도메인 모델

원칙: **콘텐츠 중복 금지, 참조로 연결.** 기사와 매거진을 역할로 분리한다.

- **`Article` = 모든 기사**(기고자 작성 + 편집자가 매거진용으로 쓴 글 모두). 단일 원천.
  - `/articles` 목록·`/articles/[slug]` 상세·북마크·조회수·RAG의 1급 시민.
- **`Magazine` + `MagazinePage` = 매거진 콘텐츠.** 편집자가 **기사 원문을 보고 페이지를 구성**(이미지+텍스트 블록). 매거진용 편집본 텍스트는 **페이지 블록(layout)** 에 저장.
- **연결 = `MagazinePage.articleId → Article`** (기존 필드 활용). 페이지가 어떤 기사를 "싣는지". 기사 상세엔 "실린 곳", 매거진엔 출처.

### 두 워크플로
- **상황 1 (기고 원본 있음):** 기고자가 Article 작성 → `/articles`. 편집자가 그 원문을 보고 매거진 페이지 구성(편집본은 페이지 블록에만). 페이지를 원본 Article에 연결. → `/articles`엔 원본 1건 + "실린 곳: STAGE N호".
- **상황 2 (매거진 전용 글):** 편집자가 매거진용으로 직접 쓴 글도 **Article로 등록**(/articles 노출) + 매거진 페이지에 연결. → **현재 39호 4개 글이 이 경우.**

### 폐기
- `MagazineArticle` 모델 → 데이터는 `Article`로 이전(상황 2), 모델/테이블 제거.
- `MagazineArticleChunk` → `ArticleChunk`로 이전, 제거.
- 라우트 `/magazines/[id]/[slug]`(매거진기사 텍스트 리더) → `/articles/[slug]` 301 리다이렉트(사용자 확정).
- `Article.magazineId`/`sourceArticleId` **불필요**(관계는 `MagazinePage.articleId` 하나).

### AI 마에스트로(매거진 내용 답변)
- 기사 본문 = `Article.content` → `ArticleChunk` (현행).
- 매거진 편집본 텍스트(페이지 블록, 원문과 다를 수 있음) = **페이지 블록 텍스트를 별도 색인**(Phase C/후속): 구성형 `MagazinePage.layout`에서 텍스트 추출 → 매거진 출처 청크. 현재 39호는 Article로 이전된 본문이 곧 매거진 텍스트라, 우선은 Article 색인으로 커버.

## 1. 데이터 마이그레이션 (운영, 풀러→raw SQL+체크섬 등록)

현재 데이터: 매거진기사 8건 전부 39호(구성형), 각 1페이지 연동, 본문 보유 → **상황 2(매거진 전용)** 로 간주해 Article로 이전.

1. (스키마 변화 최소) `Article`엔 새 컬럼 **불필요**. 필요한 건 기존 필드뿐.
2. 각 `MagazineArticle` → `Article` INSERT. **id 재사용**(MagazinePage.articleId·chunk FK가 그대로 유효). 매핑: title, slug, content, author, genre, subCategory, thumbnailUrl, status, publishedAt → Article. excerpt는 본문에서 생성. isPremium=false, aiIndexable=true.
   - 슬러그 **전역유일화**: Article.slug는 전역 @unique. 충돌 시 `"{slug}-{issue}호"`. (39호 4건 → 충돌 거의 없음, 발생 시 접미사)
   - 매거진-표현 필드(section/sortOrder/isCoverStory/layoutOptions)는 **페이지가 표현**하므로 이전 안 함(필요시 section만 기록 검토).
3. `MagazinePage.article` FK를 `MagazineArticle` → `Article`로 전환(같은 id라 데이터 유효).
4. `MagazineArticleChunk` 행 → `ArticleChunk` 복사(같은 articleId·임베딩 벡터 그대로). 구 청크 테이블 보존 후 드롭(Phase D).
5. `Magazine.articles` 관계 제거(이제 page.articleId로 도달).
6. 검증 후 `MagazineArticle`·`MagazineArticleChunk` 드롭.

## 2. 코드 영향 (Explore 매핑 기준)

| 영역 | 변경 |
|---|---|
| `/magazines/[id]/[slug]/page.tsx` | 제거 → `/articles/[slug]`로 301. 기사 상세가 "실린 곳"(page.articleId 역조회) 표시 |
| `/articles/page.tsx` | 2모델 병합 제거 → 단일 `Article` 쿼리. "실린 곳" 배지는 page 역조회 |
| `articles/[slug]/page.tsx` | 기사 상세에 "실린 곳: STAGE N호" 표시(page.articleId 역조회) |
| `magazine-article-actions.ts` | 제거/흡수 → `article-actions.ts`. 매거진 내 정렬·커버는 **페이지 편집**으로 일원화 |
| 어드민 매거진 편집 | 매거진기사 CRUD 화면 정리. 페이지 편집기에서 "이 페이지가 싣는 기사" = Article 선택(이미 articleId 존재) |
| `page-editor.tsx`/`page-actions.ts` | articleId가 Article을 가리킴(드롭다운 소스 = Article) |
| `rag.ts`/`maestro-tools.ts`/`/api/chat` | `generateMagazineArticleEmbeddings` 제거, search 3-way→2-way, href `/articles/[slug]`. (후속: 페이지 블록 텍스트 색인) |
| `view-tracker`/`/api/views` | 매거진기사가 Article이 되며 type "article" 조회수 |
| Bookmark | 자동 지원(Article FK) |
| types | `MagazineArticle` 제거, `magazine.ts`/`article.ts` 정리 |

## 3. 위험 / 완화
- 슬러그/URL 변경 → 구 `/magazines/[id]/[slug]` 301 리다이렉트(매핑 보존).
- FK 전환은 id 재사용으로 무손실. 구 테이블 즉시 드롭 안 함(롤백 여지).
- 데이터량 소량(4건) → 위험 낮음. 위험은 코드 스왑 범위(~다수 파일).
- 매거진 "기사 순서/커버스토리"는 페이지(sortOrder/layout)로 표현 — 기존 매거진기사 정렬 UX 대체 설계 필요.

## 4. 단계(Phase)
- **A. 데이터 이전:** MagazineArticle→Article(id 재사용)+슬러그 유일화+page FK 전환+chunk 이전. 구 테이블 보존.
- **B. 코드 스왑:** /articles 단일 쿼리, 상세 통합+구URL 리다이렉트, RAG/AI/뷰어/어드민 전환.
- **C. 어드민 UX:** 페이지 편집기에서 기사 연동(articleId=Article) + 매거진 전용 글을 Article로 등록하는 흐름 정리.
- **D. 정리:** MagazineArticle/Chunk 모델·테이블·죽은 코드 제거. (후속) 페이지 블록 텍스트 RAG 색인.
- **E. 기사 상세 v2 디자인:** 통합 상세에 적용.

## 5. 남은 소소한 결정
- section(커버스토리 등 라벨) 이전 여부: 페이지 블록이 표현하므로 미이전 기본. 필요시 Article 메타로 보관?
- 매거진 내 "기사 정렬/커버스토리" UX를 페이지 기반으로 어떻게 노출할지(Phase C).
