# STAGE 요구사항명세서 (SRS)

> **정본(canonical) 요구사항 문서.** "무엇을 / 왜"를 정의하고, 현재 코드 기준의 정확한 현황을 기록한다.
> **작성:** 2026-06-18 · Claude Code 세션 (claude.ai 웹 기획 대화 + 실제 코드베이스 검증 기반)
> **저장소:** `github.com/minjabaek-coder/stage` · **운영:** https://www.bon-stage.com (Vercel)
> **AI 기술 파트너:** (주)카이로스 · **발행기획:** 아트컴퍼니본

## 0. 문서 체계 (이 문서의 위상)

| 문서 | 위치 | 역할 |
|------|------|------|
| **요구사항명세서 (이 문서)** | `docs/requirements.md` | 무엇을/왜 + **검증된 현황** (정본) |
| 개발요구서 v1 | `ref/260616_work/STAGE_개발요구서_v1.md` | 단계별 구현 플레이북·사이트맵·DB스키마·Claude Code 프롬프트 10종 (how) |
| 디자인 시스템 | `docs/design/*` | 토큰·타이포·레이아웃·컴포넌트·UX 패턴 (how it looks) |
| 기획 대화 원본 | `ref/260616_work/chat_history.md` | 의사결정 출처 |
| 프로토타입 | `ref/260616_work/*.html` | 39호 뷰어·전략 시각화 |
| 구현 산출물(미적용) | `ref/260616_work/stage-vol39-update.tar.gz` | 웹챗 샌드박스 9파일 (아래 §4 참고) |

> ⚠️ `ref/260616_work/STAGE_개발요구서_v1.md` 의 §2 "현재 코드베이스 현황"은 **웹챗 샌드박스 상태**를 적은 것으로, **실제 `main`과 다르다.** 정확한 현황은 본 문서 §4가 정본이다.

---

## 1. 제품 비전

**STAGE = 문화예술 AI 매거진.** 독자 여정은 **읽고 → 묻고 → 더 듣는** 3단계.

- 1~38호: Supabase Storage의 WebP eBook (현재 운영 중)
- 39호~: **구조화 텍스트** 기반 인터랙티브 eBook + AI 마에스트로
- 축적 데이터는 향후 SaaS 플랫폼 **StageOS**의 데이터 자산으로 재활용

### 1.1 월간객석(auditorium.kr) 대비 차별점

| 항목 | 월간객석 | STAGE |
|------|----------|-------|
| 콘텐츠 형식 | 인쇄→JPG 스캔 | 구조화 텍스트 + 인터랙티브 |
| 검색 | 연·월 단순 목록 | AI 자연어 검색 |
| 독자 참여 | 없음 | AI 마에스트로 Q&A |
| 수익 모델 | 인쇄 구독 + 지면 광고 | 멤버십 + 네이티브 광고 + 티켓 + 교육 + StageOS |
| 데이터 | 비정형 | 정규화 → StageOS 자산 |

심층성·공신력은 계승, 디지털/검색/회원/AI 부재는 새로 설계한다.

---

## 2. 창립 요구사항 (사용자 원문 9개)

1. 월간객석 분석 → 개선점 도출
2. 온라인 잡지 모델에 맞는 **회원가입 정책** 필요
3. 1~38호는 이미 **JPG eBook**으로 Supabase에서 운영 중
4. 39호부터는 월간객석의 장점을 살린 **우리만의 ebook 매거진**
5. CMS도 1~38호와 입력이 달라야 함 (또는 글을 JPG화해 39호로 올리는 안)
6. **콘텐츠를 학습해 마에스트로 AI가 답변** — **이게 키포인트**
7. 매거진 외 **기사·광고·티켓할인·교육정보**로 확장
8. STAGE 데이터는 추후 **StageOS의 DB로 재활용** → 이를 고려한 데이터 관리
9. 기사 **요청·작성·편집이 쉬워야** 하고 CMS에 반영

---

## 3. 핵심 의사결정 & 근거 (Decision Log)

| # | 결정 | 근거 (왜 이렇게) |
|---|------|------------------|
| D1 | **39호+는 구조화 텍스트** (5번의 "JPG화 안"은 **비채택**) | JPG는 텍스트가 이미지에 묻혀 **임베딩·검색·접근성·SEO·TTS가 전부 막힘** → 키포인트(6번) 불가. 1~38호 WebP는 레거시로 유지. |
| D2 | 구조화 텍스트 위에 **이북 flip 경험 유지** | 4번(매거진 같은 넘김)과 6번(AI)이 충돌하지 않음 — 넘김은 표현 레이어, 콘텐츠는 텍스트. 인쇄 매거진 미학(드롭캡·풀스크린 커버·인용블록) 보존. |
| D3 | **회원 3-tier** Guest / Member / Pro | AI 질문 횟수·아카이브 접근을 tier 전환 동기로. 소셜 로그인으로 진입장벽 최소화. (2번) |
| D4 | **AI 마에스트로 = Gemini 우선 → Claude 추후** | Gemini 무료라 초기 비용 0 + "우리가 학습·테스트 가능한 환경" 요구. 모델명/호출만 바꾸면 Claude 전환되게 설계. (6번) |
| D5 | **데이터 정규화 (StageOS 대비)** | 지금부터 articles/issues/ai_interactions/advertisements/education/문의를 정규화해야 SaaS 확장 시 마이그레이션 비용 0. (8번) |
| D6 | **광고를 매거진에 네이티브로** (StageOS 전면광고·인라인 띠·모바일 브로셔·티켓카드) | 7번 확장 + 수익화. 광고는 보라색 등으로 명확히 구분. |
| D7 | **39호 뷰어 UX = 1~38호와 동일한 넘김** | 좌/우 버튼·클릭영역·키보드·모바일 스와이프 + 하단 목차 드로어. 기존 `react-pageflip` + `MagazineTocEntry` 패턴 재사용. |
| D8 | 39호 콘텐츠는 **깡통(placeholder)로 채우고 CMS 편집** | "포맷을 보려는 것" — 섹션 7종 + 임의 본문, 이후 CMS에서 수정. |

### 3.1 39호 섹션 구성 (확정)
표지 → 목차 → 커버스토리 → 인터뷰 → 리뷰 → 스페셜 → **AI 마에스트로** → 공연·티켓·교육
(+ 광고: StageOS 전면 / 인라인 띠 / 모바일 브로셔 페이지 / 티켓 네이티브 카드)

---

## 4. 현재 상태 진단 (⭐ 실제 `main` 검증 — 2026-06-18)

> 이 절이 현황의 정본. (`ref` 개발요구서 §2의 "완성됨" 목록 상당수는 **실제 코드에 없음** — 아래로 정정.)

### 4.1 실제 `main`/운영에 존재 ✅
- 스키마: `Magazine`, `MagazinePage`, `MagazineTocEntry`, `MagazineArticle`(`contentType: image|web`), `BlogPost`, `ApiCallLog` — **그뿐**
- 매거진 1~38호 WebP 뷰어 (`react-pageflip`, 키보드/스와이프/TOC), 어드민 매거진·페이지·아티클 CRUD, Tiptap 에디터
- 블로그(현재 발행 0건) + RAG 파이프라인(Voyage 임베딩 + pgvector + `BlogPostChunk`)
- 도슨트 챗 `src/app/api/chat/route.ts` — **Anthropic Claude** 기반 (⚠️ 모델 ID `claude-sonnet-4-20250514` 가 404 → 현재 응답 불가, **D4의 Gemini 이관으로 해소 예정**)
- 인프라: Vercel + Supabase. **DATABASE_URL = Transaction Pooler(6543)** (Session Pooler에서 전환, [[stage-db-pooler]] 참조)

### 4.2 stash / tarball에만 있고 `main` 미적용 ⚠️
- **git stash** `Phase1+2 (auth/articles/culture)` — auth·단독기사·문화예술 시도분 (보관, 미적용)
- **`ref/260616_work/stage-vol39-update.tar.gz`** — 웹챗 샌드박스 9파일: `magazine-ebook-viewer.tsx`, `api/chat-maestro/route.ts`(Gemini), `article-form.tsx`/`article-status-actions.tsx`, `admin/magazines/[id]/articles/*`, `seed-issue39.ts`
- → **이 파일들은 현 repo에 없음**(검증: 전부 MISSING). 적용하려면 현재 코드와 **diff·재정합** 필요.

### 4.3 미구현 ❌ (= 본 명세의 구현 대상)
회원/Auth 실연동, 39호 구조화 ebook 뷰어, Gemini 마에스트로, 회원 3등급, 단독기사, 문화예술(공연/전시/교육), 티켓할인, 기사제보(Tip), Contact, About, 마이페이지/북마크, StageOS 랜딩, 광고 노출 시스템, 푸터 개편, SEO 전면, 모바일 검수

---

## 5. 기능 요구사항

### 5.1 매거진
- **1~38호(레거시):** WebP 페이지 eBook 유지. 변경 없음.
- **39호+ (신규, `contentType: 'web'`):** 구조화 텍스트 섹션을 **flip 뷰어**로. 좌/우 버튼·클릭영역·키보드 화살표·모바일 스와이프·상단 진행바·하단 **목차 드로어**(섹션 썸네일 카드 점프, 현위치 자동표시, ESC 닫기). 진입: `/magazines` 목록에서 39호 강조(NEW/인터랙티브 배지) → 클릭 시 뷰어.
- 섹션 안에 AI 마에스트로 인라인("이 기사 물어보기")·네이티브 광고 삽입(§3.1).
- 텍스트라 검색·복사·AI 학습·TTS 가능해야 함(D1).

### 5.2 AI 마에스트로 (키포인트)
- **엔진:** Gemini 우선(`/api/chat-maestro`), Claude 전환 가능 구조(모델·호출만 교체). 학습/테스트 환경 제공.
- **RAG:** 매거진 아티클 + 단독기사 + 문화예술 정보를 컨텍스트로. 출처 기사 링크 표시. 스트리밍 응답.
- **등급 제한:** Guest 월/세션 N회(쿠키), Member/Pro 무제한. 모든 호출 `AiInteraction` 저장.
- **배치:** 전용 페이지 `/ai-maestro`, 기사 내 위젯, 39호 뷰어 내 페이지. (기존 `docent-chat` 확장)
- **관계 정리:** 현 `api/chat`(Claude·404)와 신규 `api/chat-maestro`(Gemini)의 통합/대체 방침을 구현 시 결정(중복 회피).

### 5.3 회원 (3-tier)
- **Auth:** Supabase Auth — 소셜(카카오/네이버/구글) + 이메일. OAuth 콜백, 신규 가입 시 관심 장르 선택.
- **권한 매트릭스(초안, CMS/상수로 조정):**

| 혜택 | Guest | Member(무료) | Pro(월정액) |
|------|:---:|:---:|:---:|
| 39호+ 열람 | 커버스토리 1편 | 전체 | 전체 |
| AI 마에스트로 | 월 3회 | 무제한 | 무제한 |
| 북마크 | ✗ | ✓ | ✓ |
| 1~38호 아카이브 | ✗ | ✗ | ✓ |
| 티켓 할인 | ✗ | 15% | 20% |
| 광고 | 노출 | 노출 | 제거 |
| StageOS 얼리액세스 | ✗ | ✗ | ✓ |

- **권한 게이팅 주의:** 프리미엄 본문은 RSC flight 데이터 누수 없이 서버에서 차단 ([[stage-phase2-articles]]).

### 5.4 콘텐츠 확장
- **단독 기사**(`Article`): 카테고리 탭, 그리드, 상세(본문/태그/공유/북마크/관련/AI위젯), 프리미엄 게이팅.
- **문화예술**(`CultureEvent`): 허브 + 공연/전시/교육, 장르·지역·날짜 필터, 회원 할인 배지.
- **티켓 할인**(`/tickets`): Member 이상 할인코드.
- **기사 제보**(`Tip`) / **Contact**(`Contact`) / **About** / **광고 안내**(`/advertise`).

### 5.5 CMS (9번: 쉬운 작성·편집)
- 39호 아티클(Tiptap, 섹션/작성자/커버스토리/AI학습 허용 메타), 단독기사, 문화예술, 광고, 제보/문의 관리.
- (옵션) "AI 초안 생성" 버튼 — 제목·카테고리로 초안 자동작성.
- 현 어드민 패턴(서버액션 + Zod 한국어 + revalidate) 유지.

### 5.6 사이트 구조 / 홈
전체 사이트맵·홈 섹션 구성은 `ref/260616_work/STAGE_개발요구서_v1.md` §3·§5-5 참조(중복 기재 생략). 홈: StageOS 배너 → 히어로(최신호) → 문화예술 퀵링크 → 최신기사 → 뉴스레터 → 지난호 그리드 → 회원등급 안내 → StageOS 소개 → 푸터.

---

## 6. 데이터 모델 요구사항

- **기존 유지:** Magazine / MagazinePage / MagazineTocEntry / MagazineArticle / BlogPost / ApiCallLog
- **추가 필요(회원·상호작용):** `User(tier: guest|member|pro, interests[], snsProvider…)`, `Bookmark`, `AiInteraction`, `NewsletterSubscriber`
- **추가 필요(콘텐츠 확장):** `Article`, `CultureEvent`, `Advertisement`, `Tip`, `Contact` — 필드 정의는 개발요구서 §4.1 참조
- **StageOS 원칙(D5):** 모든 신규 테이블은 정규화·인덱스·명시적 관계. 추후 멀티테넌트 이관 비용 최소화.

> ⚠️ **DB 안전:** 운영 DB 직결, 별도 dev DB 없음. **`prisma migrate dev`/`migrate reset`/`db push` 금지** — `migrate deploy`만. `BlogPostChunk`(pgvector)는 raw SQL 마이그레이션 산물로 `schema.prisma`에 없음 → `db push` 시 DROP 위험. ([[stage-db-drift]]) 개발요구서가 `prisma db push`를 안내하나 **본 환경에선 금지**이며 마이그레이션 방식으로 대체해야 함.

---

## 7. 비기능 요구사항

- **반응형:** 모바일 320/390px ~ 데스크탑 1280/1440px. 터치 영역 ≥44px.
- **AI 가독성:** 39호+ 콘텐츠는 기계 판독 가능한 구조화 텍스트(D1).
- **SEO:** 페이지별 `generateMetadata`, OG 이미지, sitemap/robots.
- **이미지:** 업로드 시 sharp WebP 최적화. **매거진 뷰어 이미지는 의도적으로 native `<img>`**(Vercel Image Optimization 한도/비용 회피) — `next/image` 강제 전환 금지.
- **DB 연결:** Transaction Pooler(6543) 사용 — 서버리스 동시성 대비([[stage-db-pooler]]).
- **DB 쿼리 페이지:** `export const dynamic = "force-dynamic"`.

---

## 8. 제약 / 알려진 현황

- 운영 DB 직결·`db push` 금지(§6), `BlogPostChunk` 스키마 부재.
- 현재 **admin 무인증**([[stage-phase1-foundation]]) — Auth 단계에서 보호 추가.
- 도슨트 챗 모델 404 → Gemini 이관으로 해소(D4).
- 노션 2개 링크(39호 원고) 미반영 — JS 렌더라 미수집, 깡통 콘텐츠로 대체(D8). 원문 필요 시 텍스트 제공받아 반영.
- **소프트-404 (보류, 2026-06-18):** `/magazines/[id]`·`[slug]`의 `notFound()`가 404 본문은 정상이나 **HTTP 200**을 반환(Next 16 동작). generateMetadata notFound·force-dynamic 제거·error.tsx 제거 모두 무효 확인. **콘텐츠 노출은 없음(게이팅 정상)**, SEO 한정 이슈 → 향후 미들웨어 또는 Next 업그레이드로 재검토.

---

## 9. 단계 로드맵 (요약)

| Phase | 범위 | 비고 |
|------|------|------|
| **P1 기반** | DB 모델 추가 · Supabase Auth · 헤더/푸터 · 홈 완성 | 🔴 우선 |
| **P2 콘텐츠** | 단독기사 · 문화예술 · 티켓 · 제보 · Contact · About · 광고안내 | 🟠🟡 |
| **P3 AI 풀연동** | 마에스트로 전용 페이지 · RAG 확장 · 등급 제한 · 기사 위젯 | 🟢 |
| **P4 수익화/StageOS** | StageOS 랜딩 · 광고 노출 시스템 · Pro 결제(기반) | 🟢🔵 |

세부 단계·예상 소요·Claude Code 프롬프트는 개발요구서 §5~§11, 부록 B 참조.

---

## 10. 미해결 / 착수 전 확인 필요

1. ✅ **결정(2026-06-18): 현재 코드 위에 신규 구현.** Phase1/2 stash와 vol39 tarball은 **되살리지 않고 참고용으로만** 사용(필요 시 부분 발췌). 신규 구현은 `dev` 브랜치에서 진행.
2. `api/chat`(Claude) ↔ `api/chat-maestro`(Gemini) 통합/대체 방침.
3. Pro 결제 모듈(미정), 카카오/네이버/구글 OAuth 키 발급.
4. 39호 실제 원고(노션) 반영 시점·형식.
5. `db push` 금지 제약과 개발요구서의 `db push` 안내 충돌 → 마이그레이션 절차 확정.
