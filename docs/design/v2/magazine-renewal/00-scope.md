# 매거진 리뉴얼 — Stage 0: 현황·제약·스코프

> 매거진 **에디터(어드민 작성/편집)** + **공개 뷰어** 전면 리뉴얼 이니셔티브.
> 작업 흐름: 0 현황·스코프 → 1 검색·분석 → 2 명세·결정 → 3 프로토타입 → 4 코드. **단계마다 사용자 승인 게이트.**
> 구현 순서: **뷰어 먼저 → 에디터.** 작성 2026-06-26 (다중 에이전트 리서치 기반).

---

## 0. 왜 하는가 (운영 피드백)

1. **에디터**: 실제 편집이 너무 불편. 여러 페이지 구성 시 페이지를 오가기 힘들고, 편집 자유도가 낮음.
2. **뷰어**: 사용자 친화적이지 않음. 목차·확대/축소 방식이 불편.
3. 요구: 에디터는 **캔바/미리캔버스처럼** + **콘텐츠 단위 다중 페이지 관리**(한 콘텐츠=여러 페이지, 편집 중 다른 페이지 보며 작업, 페이지 패널/썸네일 이동). 뷰어는 **데스크톱+모바일** 모두.

---

## 1. 현황 감사 — 에디터 (어드민)

**콘텐츠 두 종류 공존 (kind 플래그로 분기):**
- **이미지형 1~38호** (`contentType=image`): 페이지 = 업로드 이미지 1장. 페이지 내부 편집기 **없음**. 업로드·정렬·파일명·삭제만(`PageUploadZone`+`PageListSortable`, sharp WebP).
- **구성형 39호+** (`contentType=composed`): 페이지 = `layout` JSONB(`blocks[]`). 블록 에디터 `PageEditor`로 편집.

**데이터 모델** (`prisma/schema.prisma`):
- `Magazine`(issueNumber·status·contentType·coverImageUrl) 1-N `MagazinePage` + 1-N `MagazineTocEntry`
- `MagazinePage`(kind·imageUrl·**layout Json?**·articleId·sortOrder) — `@@unique([magazineId, sortOrder])`
- 구성형 `layout` = `{ blocks: (Image|Text)[], pageBg }`, 블록 공통 `x/y/w/h(%)·z·rotation·opacity`, 텍스트는 **`fontSizePx`(기준폭 440)** — 좌표는 %인데 글자만 픽셀(혼합 모델)

**핵심 통점:**
- 🔴 **멀티페이지를 한 화면에서 못 다룸** — 구성형은 페이지마다 별도 라우트(`/pages/[pageId]`)로 `router.push`. 페이지 패널/썸네일·"다른 페이지 보며 작업" 멘탈모델 전무.
- 🔴 **블록 에디터가 원시적** — 단일 440×660 캔버스, 우하단 핸들 1개, 텍스트는 **raw HTML textarea**. 스냅·다중선택·복붙·undo·키보드 nudge·정렬가이드 없음.
- 🟡 두 콘텐츠 타입 편집 모델이 완전 이원화(통합 에디터 아님).
- 🟡 `contentType` 사실상 불변 → image→composed 전환 경로 없음.
- 🟡 정렬이 `@@unique(sortOrder)` 때문에 매번 2-pass raw SQL(`applyPageOrder`); `pageNumber=sortOrder+1` 강결합.
- 🟡 구성형은 목차 데이터 모델 없음(`MagazineTocEntry`는 이미지형 전용 수동 입력).
- 🟡 자동저장·이탈 경고 없음(명시 저장 버튼 의존) → 멀티페이지 작업 중 유실 위험.
- ⚪ 죽은 `web` enum, 자산 업로드 경로 이원화(이미지형 매거진 전용 vs 구성형 blog 업로드 재사용).

**모바일:** 블록 배치 편집은 사실상 데스크톱 전용(고정 캔버스, 마우스 드래그/핸들 전제). 페이지 관리만 부분 모바일 분기.

---

## 2. 현황 감사 — 뷰어 (공개)

**구조:** `magazines/[id]/page.tsx` → `MagazineReader`(모드 토글) → `MagazineViewer`(react-pageflip) 또는 `PagedMagazineViewer`(버튼). 확대는 `MagazineZoomLightbox` 전체화면 오버레이. 구성형은 `ComposedPage`(440×660 캔버스 통째 `transform:scale`, 텍스트는 실제 텍스트 유지). 이미지형/구성형이 **동일 뷰어 공유**.

**핵심 통점:**
- 🔴 **확대가 별도 버튼→라이트박스 진입**이라 직관성 약함(인라인 핀치는 flip 모바일에서만).
- 🔴 **TOC가 `pageNumber` 문자열 느슨 매칭**(외래키 아님, `pages.find`) → 페이지 재정렬/삭제 시 깨질 위험.
- 🟡 **flip/paged 두 뷰모드 병존**이 평가용 잠정 상태 — 일관 UX 부재, SSR 항상 flip이라 깜빡임.
- 🟡 줌/제스처 로직 중복(인라인 `usePinchZoom` vs 라이트박스 별개 구현, paged엔 인라인 핀치 없음).
- 🟡 모바일 flip '이전'이 react-pageflip 역방향 한계 때문에 자체 CSS 3D 오버레이 우회(복잡·취약).
- 🟡 **전 페이지 동시 렌더, 가상화 없음** → 페이지 많으면 초기 로드/메모리 부담.
- ⚪ 데드코드(`PageSpread`, `ViewerControls`), `magazineId` 미전달로 onFlip view 추적이 dead(별도 ViewTracker가 대체), 데스크톱/모바일 헤더 하드코딩 분기.

**모바일 vs 데스크톱:** `cw<768` 분기. 데스크톱 flip=양면 스프레드, 모바일=단면+자체 스와이프 판정.

---

## 3. 제약 (불변 조건)

1. **기존 데이터 비파괴** — 이미지형 1~38호(`kind=image`, `imageUrl` 1장/페이지, 수동 TocEntry)와 구성형 39호+(`layout` JSONB)를 모두 유지. 한쪽만 바꾸면 공유 뷰어/모델 때문에 깨짐.
2. **공유 운영 DB**(Supabase 서울) — `prisma migrate dev/reset/db push` 금지, `migrate deploy`만. `BlogPostChunk` 등 비모델 테이블 보호. `layout`이 `Json?` 컬럼이라 **스키마 변경 없이 구조 진화 가능**(안전 진입로).
3. **대륙간 DB 5s 트랜잭션 한도(P2028)** — 일괄 저장/정렬은 statement 최소화(현 2-pass 패턴 존중).
4. **`layout` 포맷 변경 시 에디터·뷰어·썸네일(`ComposedPage`)·`parsePageLayout` 동시 영향** — 함께 진화 필요.
5. **v2 에디토리얼 디자인 일관성**(공개=웜 팔레트/Noto Serif KR, admin=기본 shadcn).
6. **딥링크 `?page=` 진입** 동작 유지.

---

## 4. 스코프

**범위 안:**
- 공개 뷰어 전면 개편(데스크톱+모바일, 이미지형/구성형 공통 셸 + 종류별 분기 렌더)
- 어드민 에디터 개편(단일 셸 + 페이지 썸네일 패널 + 캔버스 편집 자유도 상향, **데스크톱 우선**)
- 목차 모델 재설계(페이지 FK 기반 공통 locator), `layout` 스키마 진화(+version, 상대단위)

**범위 밖(1차 제외 권고):** 캔바급 스마트가이드, AI Magic Resize/자동 반응형, 38개 호 좌표 일괄 소급입력, undo/redo(차순위), 에디터 모바일 자유배치 편집.

**트랙 순서:** Stage 0·1 병렬 리서치(완료) → 2 명세·결정 → 3 프로토타입 → **뷰어 구현 먼저 → 에디터 구현.**

**산출물 위치:** `docs/design/v2/magazine-renewal/` (00-scope·10-research·20-spec), 목업은 `.../mockups/`.

→ 벤치마크 분석·콘텐츠 모델 옵션·UX 방향은 [`10-research.md`](./10-research.md) 참조.
