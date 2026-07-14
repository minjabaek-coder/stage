# STAGE 작업 순서 · 진행 현황 (Roadmap)

> 실행용 living 문서. **무엇을/왜**는 [`requirements.md`](./requirements.md)가 정본, **순서/상태**는 이 문서가 관리한다.
> 항목 완료 시 상태를 갱신하고 커밋 해시를 적는다. (작성 2026-06-18)

**범례:** ✅ 완료 · 🔄 진행중 · ⬜ 대기 · ⏸ 보류 · 🚧 차단(선행 의존성 필요)
**의존성 태그:** `[MIG]` DB 마이그레이션 · `[KEY]` API/OAuth 키 · `[MEM]` 회원/Auth 선행 · `[DEC]` 방향 결정 선행 · `[ASSET]` 디자인 에셋(로고 등) 필요

---

## A. 완료 ✅

| 항목 | 영역 | 커밋/비고 |
|------|------|----------|
| 업로드 파이프라인 효율·일관성, orphan 정리 | refactor | main 머지됨 (dev-refact) |
| 어드민 상태액션 통합·N+1 수정 | refactor | main |
| 매거진 뷰어 ref 버그 수정 | fix | main |
| 썸네일/표지 orphan·게이팅 | fix | main |
| Transaction Pooler 전환 (DB 커넥션) | infra | Vercel 3개 환경 적용 ([[stage-db-pooler]]) |
| **39호 구조화-텍스트 eBook 뷰어** | feat | dev `77ae10f` |
| **web 아티클 CMS(생성/편집/발행/삭제)** | feat | dev `0c71b0c` |
| **아티클 순서변경(드래그) UI** | feat | dev `03528c4` |
| **아티클 게이팅(부모 매거진 발행 확인)** | fix | dev `49e1531` |
| **AI 마에스트로 Gemini 연동** | feat | dev `bf56c86` (GEMINI_MODEL=gemini-3.1-flash-lite) |
| **이메일 회원가입/로그인 + 헤더 회원메뉴** | feat | dev `8b12e98`·`d1052db`·`07bf474` (Playwright 왕복 검증) |
| **마이페이지(등급·관심장르·수신설정)** | feat | dev `e73cb5a` |
| **비프로덕션 draft 매거진 미리보기 게이트** | feat | dev `112ccdc` (preview/로컬만 draft 열람, prod는 발행본만) |
| **Vercel `NEXT_PUBLIC_SUPABASE_ANON_KEY` 누락 보완** | infra | 3개 환경 등록(2026-06-18) — proxy 런타임 500 해소 |

> 현 상태: 매거진(이미지 1~38 / web 39+), 블로그(0건), 도슨트 챗(Gemini), RAG(블로그 청크). 회원/Auth·콘텐츠확장·StageOS 미구현.

---

## B. 작업 순서 (Wave)

### Wave 0 — 선행 결정·준비 (다른 작업의 잠금 해제) 🚧
| ID | 항목 | 상태 | 비고 |
|----|------|------|------|
| W0-1 | **DB 마이그레이션 방식 확정** (운영DB·`db push` 금지 → `migrate deploy` 절차, `BlogPostChunk` 보존) | ✅ | dev `57f54d8`(드리프트 제거)·`df8e5f8`(워크플로우 확립). 절차: schema 모델 → `migrate diff --from/--to-schema --script` → `migrate deploy`(신규)/`resolve --applied`(기존). 잔존 테이블 = NewsletterSubscriber 1개뿐(정합 완료) |
| W0-2 | Vercel에 `GEMINI_API_KEY`(+`GEMINI_MODEL`) 등록 | ✅ | production/preview/development 3개 환경 등록 완료 (2026-06-18) |
| W0-3 | OAuth 키 발급 (카카오/네이버/구글) | ⬜ `[KEY]` | 회원/Auth 전제 |

### Wave 1 — 의존성 없는 프론트·보완 (지금 바로) ⬜
| ID | 항목 | Phase | 상태 | 연관 |
|----|------|-------|------|------|
| W1-1 | `/magazines` 39호 강조(NEW/인터랙티브 배지) | 보완 | ✅ | dev `d69fdc4` (인터랙티브는 39호 발행 후 노출) |
| W1-2 | 푸터 4컬럼 개편 | 1 | ✅ | dev `951d7f0` (실존 페이지만 링크, 나머지 준비중) |
| W1-3 | About 페이지 | 2 | ✅ | dev `2533900` (이메일 CTA, 정적) |
| W1-4 | `MagazineIssuePage` 미사용 정리 | 보완 | ✅ | dev `d69fdc4` (eBook 뷰어로 대체) |
| W1-5 | 홈 개편(히어로 정비·AI 마에스트로/StageOS 소개) | 1 | ✅ | 마에스트로 `ce2eb46`·히어로 컬러화(W1-7)·최신기사 `ad64028`·문화예술 `6729d8e`·**StageOS 밴드 `6dfa27a`** 완료 |
| W1-6 | 소프트-404 상태코드 | 보완 | ⏸ | Next16 동작, 앱레벨 불가 — 보류(미들웨어/업그레이드 시 재검토) |
| W1-7 | 최신호 표지 흑백→hover컬러 효과 제거 | 보완 | ✅ | dev `e01af5e` (피드백 반영) |
| W1-8 | 표지 워터마크(★BBStar) 제거·신규 로고 교체 | 브랜딩 | 🚧 | 피드백(2026-06-18). **워터마크가 표지 이미지 픽셀(하단중앙)에 박힘 → CSS 제거 불가.** 1~38호 표지(필요시 전 페이지) 배치 이미지합성으로 로고 오버레이 후 Supabase 재업로드 필요. `[ASSET]` 신규 로고 대기 |
| W1-9 | 매거진 뷰어/목록 UX 다듬기 | 보완 | ✅ | dev `6d6e1d7`(목록 한글화+호수/제목 검색)·`436aeeb`(뷰어 inert 접근성·reduced-motion·목차 UX). 추가 다듬기 여지 있음 |

### Wave 2 — 회원 / Auth (기반) 🚧
| ID | 항목 | Phase | 상태 | 의존성 |
|----|------|-------|------|--------|
| W2-1 | User/Bookmark/AiInteraction/NewsletterSubscriber 모델 + 마이그레이션 | 1 | ✅ | Newsletter `06f179c`·User/AiInteraction `c852034`·**Bookmark `eec57a6`** 완료 |
| W2-2 | Supabase Auth — 이메일 ✅ / 소셜 OAuth ⏸ | 1 | 🔄 | 이메일 인증·세션·동기화 완료(plumbing `8b12e98`·플로우 `d1052db`). 소셜은 `[KEY]` W0-3 대기(보류) |
| W2-3 | 헤더 회원 메뉴·등급 배지 실연결 | 1 | ✅ | dev `07bf474` (useUser·HeaderAuth, 로그인/로그아웃 왕복 검증) |
| W2-4 | 어드민 보호(무인증 해소) | 보완 | ⏸ | **사용자 요청 시 진행(보류, 2026-06-18)**. 방식 결정 = **DB role 컬럼** `[MIG]` |
| W2-5 | 뉴스레터 폼 실제 연결 | 1 | ✅ | dev `06f179c` (구독/중복 검증 완료) |

### Wave 3 — 콘텐츠 확장 🚧
| ID | 항목 | Phase | 상태 | 의존성 |
|----|------|-------|------|--------|
| W3-1 | 단독 기사(Article) 목록/상세/CMS | 2 | ✅ | A1 모델+마이그 `4c822c1`·A2 어드민 CMS `86b2c4b`·A3 공개목록/상세/SEO/프리미엄게이팅 `c219f4e`·A5 홈 최신기사 `ad64028`. 조회수 트래킹은 후속 |
| W3-2 | 문화예술(CultureEvent) 공연/전시/교육 + CMS | 2 | ✅ | C1 모델+마이그 `7b0a30a`·C2 CMS `915583e`·C3 공개목록/상세/SEO `96d1938`. 유형별 티켓/교육 분기, 회원할인 표기 |
| W3-3 | 티켓 할인 페이지 | 2 | ✅ | dev `0215079` — /tickets, 회원할인 이벤트 집계 + 멤버십 CTA. CultureEvent 재사용 |
| W3-4 | 기사 제보(Tip) + 어드민 | 2 | ✅ | dev `048e7b2` — 공개 /tip 폼 + 어드민 수신함(처리/삭제). 첨부 업로드는 향후. 동 커밋에 클라 날짜 하이드레이션 픽스(formatKST) 포함 |
| W3-5 | Contact + 어드민 | 2 | ✅ | dev `6de7fae` — 공개 /contact 폼 + 어드민 수신함(처리/삭제). 푸터 링크 연결 |
| W3-6 | 광고(Advertisement) 안내+노출 시스템 | 2·4 | ✅ | Lean `4256254`(모델·CMS·/advertise) + **Full**: placement `76c45e5`·AdSlot/홈 `e74caa3`·매거진/기사 `df1a32b`·노출/클릭 트래킹 `dcda5c7`. select 팝업·저장 UX 픽스 포함 |
| W3-7 | 마이페이지/북마크 | 2 | ✅ | 마이페이지 `e73cb5a`(등급·관심장르·수신설정)·**북마크 `eec57a6`**(토글 + 마이페이지 목록) |

### Wave 4 — AI 심화 · StageOS · 수익화 🚧
| ID | 항목 | Phase | 상태 | 의존성 |
|----|------|-------|------|--------|
| W4-1 | **매거진 RAG 확장**(아티클 임베딩→마에스트로가 39호 내용 답변) | 3 | ✅ | dev `d760894` — MagazineArticleChunk + 발행 시 자동 임베딩 + 블로그/매거진 UNION 검색(출처 href). 발행 매거진 아티클 생기면 자동 학습. ⚠️ 잔여: "최신호 몇 호?" 같은 **메타데이터 질문**은 청크가 아니라 별도(시스템 프롬프트에 매거진 메타 주입) 필요 |
| W4-2 | AI 마에스트로 전용 페이지 `/ai-maestro` | 3 | ✅ | dev `e3a85a2` — 전용 페이지(ChatBody 재사용) + 푸터/홈 링크 |
| W4-3 | 기사 내 AI 위젯 | 3 | ✅ | dev `8fafe48` — 기사 상세 위젯(질문 시드→챗 프리필). ⚠️ 단독 기사 임베딩(W4-9) 전엔 마에스트로가 단독 기사 내용을 모름. 편집폼 Base UI 경고 픽스 `a2ce617` |
| W4-4 | 등급별 AI 횟수 제한 | 3 | ✅ | dev `c8d793f` — 24h 한도(게스트5/멤버30/프로무제한), AiInteraction 카운트·로깅 |
| W4-5 | StageOS 랜딩 | 4 | ✅ | dev `04f833f` — /stageos(README 기반 카피·제품 스크린샷·도입 문의 CTA→/contact). StageOS=카이로스팀 B2B SaaS(BIPA 2026). 배포 후 stageos.app 연결로 교체 가능. 참고: `.gitignore` 전역 `*.png` 때문에 공개 이미지는 force-add 필요 |
| W4-6 | Pro 결제(기반) | 4 | 🔄 | **예고 완료** dev `b92cbc7` — /membership(혜택+가격 "공개 예정"+출시 알림 source=pro-waitlist). **실 결제 후속**: PG사+키 `[KEY]`·통신판매 신고·가격·정기결제·환불정책 결정 필요 → 결제 페이지·웹훅·tier=pro 승급 |
| W4-7 | SEO 전반(generateMetadata/sitemap/robots/OG) | 보완 | ✅ | dev `481a8fb` (metadataBase·OG·twitter·sitemap·robots·상세 canonical). 기본 OG 이미지 에셋은 `[ASSET]` 후속 |
| W4-9 | **RAG 임베딩 커버리지 확대** (단독 기사 Article·문화예술 CultureEvent) | 3 | ✅ | 단독 기사 임베딩 `52a4b78`(ArticleChunk·발행 시·3-way 검색·aiIndexable). **문화예술은 W4-8의 `get_culture_events` 구조화 도구로 대체** — 임베딩 불필요(결정 완료). 추가 작업 없음 |
| W4-8 | **AI 마에스트로 고도화 — function calling 기반 에이전틱 RAG** | 3 | ✅ `dev 64f67d1` — 도구 3종(search_content·get_magazine_facts·get_culture_events) 에이전틱 루프. 하드코딩 grounding 제거, 문화예술은 구조화 도구로 처리(임베딩 불필요). 향후 도구 추가로 확장 ⟶ 이전 계획: | 현재 구조화 사실(호수·통계 등)을 시스템 프롬프트에 **하드코딩 주입**(W4-1 잔여 stopgap) → 질문 유형마다 추가 필요·확장성 없음. 개선: 모델이 런타임에 **읽기전용·파라미터화 도구**를 호출(searchContent=벡터RAG, getMagazineFacts, getEvents 등). Gemini function calling 지원. **open text-to-SQL은 운영DB 보안상 지양**(화이트리스트 도구 우선). 멀티스텝 에이전틱 루프(필요시 재질의)·검증 단계. 근거: 에이전틱 RAG/function calling 2026 best practice. ☞ 완료 시 하드코딩 grounding 제거 |

---

## C. 의존성 흐름 (요약)

```
W0-1(마이그레이션 방식) ─┬─▶ W2(회원/Auth) ─┬─▶ W3-3/W3-7(티켓·마이페이지), W4-4(등급제한)
                         ├─▶ W3-1/2/4/5/6(콘텐츠 모델)
                         └─▶ W4-1(매거진 RAG 청크)
W0-3(OAuth 키) ─▶ W2-2(Auth)
W0-2(Vercel GEMINI) ─▶ 배포 시 챗 동작
Wave 1 (W1-*) : 위 의존성과 무관하게 병렬 진행 가능
```

## D. 추천 진행 순서
1. **W0-2**(Vercel GEMINI 등록) — 5분, 배포 안전성. 
2. **Wave 1**에서 골라 진행(의존성 0): W1-4 정리 → W1-1 39호 강조 → W1-2/3 푸터·About.
3. **W0-1 결정**(마이그레이션 방식) — 이게 풀려야 회원·콘텐츠·RAG확장 전체가 열림.
4. 이후 **Wave 2 → 3 → 4** 순.

---

## E. v2 리뉴얼 — 상세 수정 워크플로우 (2026-06-23 확정)

> 기준: `ref/260619_work/stage_full_preview.html` → [`docs/design/v2/`](./design/v2/README.md) 명세 + [`docs/account-permissions.md`](./account-permissions.md) 사양.
> 원칙: **단계별 검증·dev preview 푸시 + 최종 전면 E2E** / **계정·어드민 통합 + 스키마 조기 반영** / main 머지는 별도 협의.
> 각 단계 진입 시 미결 항목은 **선택지 제시 후 결정**(혼자 판단 금지).

| Phase | 내용 | 상태 | 검증/푸시 |
|-------|------|------|----------|
| **0 준비** | 모바일 미결 3개 결정(좌측내비 대체·헤더 메뉴·도슨트 FAB) `[DEC]` | ✅ | 결정(2026-06-23): **하단 탭바 + 메뉴 드로어 + 상단 장르바**, FAB=데스크탑 플로팅/모바일 AI 탭. [global-chrome §6·§7](./design/v2/global-chrome.md) 반영 |
| **1 토대** | 폰트(Noto Serif/Sans KR·DM Mono) ✅ + 토큰 레이어 ✅ + 공통 셸: 청크①StageOS배너 ✅·②헤더 ✅·③장르내비 ✅·④푸터 ✅ | ✅ | 완료 |
| **1.5 스키마** | `UserRole`(user/admin)+User.role · `ArticleStatus`(draft/submitted/published, Article.status 전용 enum 전환) · `ArticleEditToken` 모델 | ✅ | dev `e6654c2` — raw SQL+체크섬 등록, tsc·스모크 정상. prod-break 허용으로 enum 직접 전환(main은 Phase 6 전까지 submitted 미인지) |
| **2 홈** | 3컬럼·좌측내비·본문 블록·우측 위젯 + 모바일 | ✅ | 완료 |
| **3 페이지별** | 매거진 목록/뷰어 · 기사 목록/상세 · 티켓 · AI마에스트로 · 마이페이지 · about · membership · stageos(B) · auth · 통합문의. 블로그 제거 ✅ / 공연전시 목록→티켓 통합 ✅(상세 유지·브레드크럼) / 문의 단일화 ✅. **부가 완료: 대분류·소분류 택소노미 ✅ / 기사·매거진 모델 병합(MagazineArticle 제거) ✅ / 썸네일 크롭+히어로 비율 ✅ / 마에스트로 Tier1 ✅** | ✅ | 페이지별 스모크 완료(dev 푸시는 Phase 5 후) |
| **4 계정+어드민** | `/admin` role 게이트 + 기고자 무계정 토큰·`/contribute/{token}` + 어드민 CMS(검토대기 상태·토큰 발급/회수·필드 권한) + **관리자 설정형 StageOS 배너(콘텐츠 편집·노출 토글)** + **관리자 설정형 홈 광고 위치**. 진입 시 미결 7개 `[DEC]` 선택지 제시 | ✅ | ①role게이트 `a993ba6`(비-admin 404)·②기고자토큰+`/contribute` `366b4c6`(+lint `68995f4`)·③어드민CMS(토큰카드·상태필터) `ac8945a`·④설정형 StageOS배너+`/admin/settings` `a198798`(SiteSetting 키-값 모델, mig `20260625010000`). 홈 광고위치=기존 AdSlot(placement=home)으로 이미 동작·확인. 미결 7개 결정: #1 수기 role UPDATE·#2 404+레이아웃가드·#5 TTL30일 기본+회수/재발급·#6 관리자 임의생성만·#7 수동 재발급. **Playwright 왕복 검증 완료**(role게이트 404/admin접근·토큰 발급→`/contribute` 에디터→회수·설정 저장→공개배너 반영) | 
| **5 전면 검증 + dev push** | Playwright E2E(공개+어드민+기고자 토큰) + 라우트 200/콘솔0 + 회귀 → **dev origin 푸시** | ✅ | **dev 푸시 완료 `e3c4c09`**(origin/dev 동기화). 빌드 그린·공개 200·admin게이트 404·콘솔0. 다중역할 기고 라이프사이클 + 전수 재검증 10종(북마크·뉴스레터·문의/제보(Tip 분기)·CRUD 광고/문화/매거진·조회수·프리미엄게이팅·인증 3종·AI챗) 전부 통과. **부수 정리:** 사이드바·푸터 v2(광고 이미지화+AD라벨·StageOS/Weekly 위젯·패밀리 드롭다운) `cfcd9a8` / 블로그 어드민 잔재 제거(공개 블로그 v2 제거 정합, /admin/blog·대시보드→기사·sitemap) `6a2e23d` / 기사 조회수 트래킹·sitemap 죽은URL·마에스트로 블로그카피 `e3c4c09`. **보류:** 매거진 soft-404(W1-6) |
| **6 마무리 + main PR** | 최종 정리 → dev→main PR 병합 | ⬜ | main PR |
| **(후속) 마에스트로 RAG 개선** | 코퍼스 채우기(재색인·발행·embeddingStatus) → 리랭킹/하이브리드 → 매거진 블록 색인. 계획: [`design/ai-maestro-rag-plan.md`](./design/ai-maestro-rag-plan.md) | ⬜ | Phase 6 후 |

**진행 순서(2026-06-24 확정):** 1.5 → 4 → 5(+dev push) → 6(main PR) → 마에스트로 RAG. **dev push는 Phase 5 이후, main 병합은 Phase 6에서 dev→main PR.**

**보류 결정(2026-06-23):** prod/dev **DB 분리는 논의했으나 보류** — 공유 운영 DB 유지. dev에서 enum·데이터·마이그레이션 변경 시 **운영(main) 배포본에 영향** 줄 수 있으니 주의(예: composed 크래시). 추후 별도 dev Supabase 프로젝트로 분리 검토.
**연관 결정 문서:** 디자인 미결 → [`design/v2/ux-home.md`](./design/v2/ux-home.md) 부록 / 계정 미결 7개 → [`account-permissions.md`](./account-permissions.md) §8.
**기존 항목 갱신:** W2-4(어드민 보호) → Phase 4에서 `role` 게이트로 진행 확정(보류 해제).

---

## 갱신 규칙
- **각 Phase(§E) 완료 시 이 문서를 즉시 최신화**(상태 ✅·완료 내용·커밋 해시 반영). (2026-06-24 합의)
- 항목 완료 시: 상태 ✅ + 커밋 해시 기입, A절로 이동(또는 표 내 표시).
- 새 항목/결정 발생 시: 해당 Wave에 추가하고 의존성 태그 표기.
- requirements.md의 결정(D1~D8, §10)과 어긋나면 requirements.md를 정본으로 맞춘다.
