# 에디터 캔바화 리뉴얼 — Stage 2 명세서

> 근거: [`00-research.md`](./00-research.md)(Stage 0 다중에이전트 리서치) + [`mockups/editor-proto.html`](./mockups/editor-proto.html)(Stage 1 승인 인터랙티브 프로토타입, 2026-06-29).
> 다음: 이 명세 승인 → Stage 3+ 단계 구현(각 Phase 별도 게이트).

---

## 0. 전제 · 불변식 · 확정 결정

**불변식(절대 유지):**
- 캔버스 = **고정 2:3**(기준 440×660px), 모든 좌표 `x/y/w/h`는 캔버스 대비 **% 상대단위**, `fontSizePx`는 440 기준 절대값.
- `layout`은 `MagazinePage.layout` **JSONB** 한 곳에 저장. **편집(page-editor) = 뷰(composed-page) 일치** — 동일 `Block[]`을 양쪽이 렌더(ComposedBlockBody 공유).
- **신규 캔버스 라이브러리(Konva/fabric/tldraw) 미도입.** 기존 pointer-capture + %-절대배치 DOM을 확장.
- **편집은 데스크톱 전용**(모바일은 페이지 관리만). 운영 DB는 **`migrate deploy`만**(BlogPostChunk 드리프트, `db push`/`migrate dev` 금지).

**확정 결정(사용자):**
| # | 결정 |
|---|---|
| D1 | 다음 단계 = 목업 → 명세 → 구현 (현재 명세 단계) |
| D2 | **도형 1차 = rect / ellipse / line** (CSS만, 인라인 SVG는 line만). triangle/star는 후순위 |
| D3 | **클립보드 = 페이지 간 복붙까지** (셸 레벨 store) |
| D4 | **"이미지"와 "이미지 프레임" 통합** — 추가 도구는 "이미지" 하나, **채움/맞춤(fit)은 속성**으로 |
| D5 | **새 페이지 = 현재 페이지 다음에 삽입** (맨 끝 아님) |
| D6 | 레이아웃 = 캔바/PPT식(좌 도구 레일 · 중앙 캔버스 · 우 속성+레이어 · 하단 페이지 스트립). 기존 3컬럼 셸 탈피 |

---

## 1. 데이터 모델 명세 (`src/types/magazine-layout.ts`)

### 1.1 Block 확장
```ts
type BlockBase = {
  id: string; x: number; y: number; w: number; h: number; z?: number;
  rotation?: number; opacity?: number;
  groupId?: string;            // NEW — 평면 그룹 태그(트리 아님 → 뷰어 무변경)
};
type TextBlock  = BlockBase & { type:'text'; html:string; color?; fontSizePx?; align?; weight?; lineHeight?; bgColor?; padding? };
type ImageBlock = BlockBase & { type:'image'; src:string; fit?:'cover'|'contain'; focusX?; focusY?; zoom?; radius?; overlayDarken? }; // 프레임=fit 속성으로 흡수(D4)
type ShapeBlock = BlockBase & { type:'shape'; shape:'rect'|'ellipse'|'line';   // NEW (D2)
  fill?: string; stroke?: string; strokeWidth?: number; radius?: number };
type Block = TextBlock | ImageBlock | ShapeBlock;
```
- **z 운영**: 현재는 배열 순서가 곧 z(렌더 시 정렬). 레이어 패널·맨앞/맨뒤는 배열 순서 재배치로 처리(기존 방식 유지) — `z` 필드 의존 최소화.

### 1.2 `parsePageLayout` — **필수 변경(누락 시 데이터 소실)**
- 블록 필터에 **`type==='shape'` 분기 추가**, `groupId`·shape 속성 통과. 미인식 필드 보존(forward-compat). 39호 등 기존 데이터 마이그레이션 **불필요**(additive).
- `layout.version` 있으면 읽기호환 유지(현행 동작 보존).

### 1.3 서버 sanitize (`updatePageLayout` / `sanitizeLayout`)
- shape `fill`/`stroke`는 **색·그라데이션 문자열 화이트리스트 검증**(XSS 차단; `#hex`, `rgb()/rgba()`, `linear-gradient(...)` 허용 패턴만). 텍스트 html sanitize는 현행 유지.
- `groupId`·shape 수치 필드 타입 검증.

### 1.4 스키마/DB
- **1차 마이그레이션 없음**(전부 JSONB 내부 확장). 
- **사용자 템플릿(P4c, 2차)** 만 신규 모델 `PageTemplate { id, magazineId?, name, layout(Json), createdAt }` → 그때 `migrate deploy` 1건.

---

## 2. 상호작용 규약

### 2.1 히스토리 (P1, 모든 파괴적 기능의 선행)
- 자료구조: **전체 스냅샷** `{ past: Doc[]; present: Doc; future: Doc[] }`, `Doc = { blocks, pageBg }`. 외부 의존 없이 `useReducer`/커스텀 훅. 상한 **100**.
- **commit 경계(=⌘Z 1단위)**: `onDragEnd`, 리사이즈 종료, 속성 onChange/blur, add/remove/duplicate/paste/zOrder/align/group, nudge keyup(연타는 250ms debounce 후 1엔트리). 드래그/리사이즈/nudge **중**에는 present만 갱신(amend, past에 안 쌓음) → "드래그 한 번 = ⌘Z 한 번".
- redo 스택은 새 commit 시 비움. 자동저장(1.2s)·언마운트 flush와 정합(스냅샷=layout v2 그대로라 서버 무변경).

### 2.2 선택
- `selectedId` → **`selectedIds: string[]`**. 단일(1개)일 때만 우측 속성 전체 노출, 다중이면 "N개 선택 + 정렬/분배/그룹".
- 클릭=단일 선택, **Shift-클릭=토글**, 빈 캔버스 드래그=**마키(러버밴드)**. 교차 판정 AABB: `!(a.x+a.w<b.x || b.x+b.w<a.x || a.y+a.h<b.y || b.y+b.h<a.y)`. 빈 캔버스 클릭(드래그 아님)=선택 해제.
- 우선순위 가드: 인라인 편집중 > 핸들 > 블록 > 마키.

### 2.3 이동 / 리사이즈 / 스마트 가이드
- 단일: 기존 `onDragMove` 유지. 다중: 선택셋 합집합 **그룹 바운딩박스(GB)** 기준 — 이동은 dx/dy 전원 동일 적용 + GB 기준 clamp, 리사이즈는 `nb.x=GB.x+(b.x-GB.x)*sx; nb.w=b.w*sx`.
- **스마트 가이드**: 스냅 타깃 = 캔버스 `[0,50,100]` + **비선택 블록들의 left/centerX/right·top/middle/bottom**. 임계는 **px 기준(≈6px)** 을 %로 환산(`6/rectW*100`). 기존 분홍 `snap.v/h` → `snapLines:{axis,pos}[]` 배열로 확장. 균등간격 배지(↔ N%)는 옵션(P2 포함 여부 = 미해결 #3).
- 최소 크기 4%(w)/3%(h) 유지. GB clamp vs 개별 최소크기 충돌 시 GB 우선.

### 2.4 정렬 / 분배
- 단일: 캔버스(0~100) 기준(현행). 다중: **GB 기준** 6정렬 + 분배(3개+) `gap=(축길이-Σ크기)/(n-1)` 누적. 순수 함수 `getBoundingBox`/`alignTo`/`distribute`로 분리.

### 2.5 그룹
- **`groupId` 평면 태그**(트리 미도입 → 뷰어 무변경). ⌘G=선택셋에 동일 groupId, ⌘⇧G=해제. 그룹 내 한 블록 클릭 시 그룹 전체 선택(이동 함께). 정렬/리사이즈는 GB 로직 재사용.

### 2.6 복제 / 클립보드 / 단축키
- **복제(⌘D)**: `{...blk, id:uid(), x:clamp(x+2.3), y:clamp(y+2.3)}`(2.3%≈10px), z=맨앞, 복제본 선택. 다중 복제 지원.
- **클립보드(D3, 페이지 간)**: **셸(`magazine-editor-shell`) 레벨 store 또는 모듈 스코프**(PageEditor가 `key`로 리마운트되어 로컬 ref 소실되므로). ⌘C=선택 블록 직렬화 저장, ⌘V=현재 페이지에 새 id로 붙여넣기(오프셋). (선택) `navigator.clipboard`에 JSON 병행은 후순위.
- **단축키 표**:

| 키 | 동작 | 가드 |
|---|---|---|
| ⌘Z / ⌘⇧Z·⌘Y | 실행취소 / 다시실행 | 인라인 편집중엔 Tiptap history가 처리(배타) |
| ⌘C / ⌘V | 복사 / 붙여넣기(페이지 간) | input/contenteditable 포커스 시 무시 |
| ⌘D | 복제 | preventDefault(북마크 충돌) |
| ⌘A | 전체 선택 | 〃 |
| Del / Backspace | 선택 삭제 | input/contenteditable 포커스 시 무시(글자 삭제 보존) |
| 방향키 / Shift+방향키 | 1px / 10px nudge(%환산) | 인라인 편집중 무시(캐럿 이동) |
| Esc | 선택 해제 / 편집 종료 | |
- 공통 가드: `if (editingId || /INPUT|TEXTAREA|SELECT/.test(tag) || target.isContentEditable) return;`

### 2.7 도형 (P3, D2)
- 추가: 좌측 레일 `도형` → 팝오버(rect/ellipse/line) → `addShape(shape)`(중앙, 맨앞). 
- **렌더(ComposedBlockBody 한 곳만 분기 → 에디터·뷰어·썸네일·라이트박스 전 표면 일관)**: rect=`background`+`borderRadius`, ellipse=`borderRadius:50%`, line=컨테이너 안 인라인 `<svg viewBox="0 0 100 100" preserveAspectRatio="none">`+`vector-effect="non-scaling-stroke"`. fill=색/그라데이션 문자열, stroke=`border`.
- 속성: 채움색·(테두리 색/두께)·모서리(rect). 드래그/리사이즈/회전/정렬/z/그룹은 BlockBase 기반 **무수정 재사용**.
- 제약: stroke 그라데이션 미지원(border-image×radius 충돌). 아이콘/스티커는 후순위(1차는 이미지 업로드로 대체).

### 2.8 이미지 (D4)
- 추가 도구 = "이미지" 하나. 업로드/교체 + **채움(cover)/맞춤(contain)** 토글·초점·줌·어둡게·모서리는 **속성 패널**에서. (기존 ImageBlock 그대로, 별도 "프레임" 타입/버튼 제거.)

### 2.9 페이지 (P4)
- **현재 다음 삽입(D5)**: `createComposedPage(magazineId, opts?:{ afterPageId?; layout? })`(무인자 호환). `afterPageId` 지정 시 INSERT 후 **`applyPageOrder` 1회**(기존 2-pass raw SQL 재사용 — 유니크/P2028 회피). 생성 후 `setSelectedId(r.pageId)` 포커스.
- **복제**: `duplicatePage(pageId)` — layout 깊은 복사 + **전 블록 id 재생성**(필수, 충돌 시 dnd-kit/React key/patch 깨짐). composed src=public URL이라 Storage 복사 불필요. `articleId=null` 기본.
- **레이아웃 프리셋**: `magazine-presets.ts` 코드 상수 `PAGE_PRESETS[].build():PageLayout`(표지형/2단/풀사진+캡션 등). 적용: 빈 페이지면 즉시, 내용 있으면 `confirm` 가드(undo 구현 후 완화). 썸네일=ComposedPage 미니 렌더(자산 0).
- **사용자 템플릿(P4c, 2차)**: `PageTemplate` 모델 + 저장 시 `sanitizeLayout`.

### 2.10 캔버스 조작 (P5)
- **줌**: 뷰포트(overflow-auto)와 transform 레이어 분리, 레이어 `transform:scale(zoom); transformOrigin:0 0`. 25~500%. 커서기준 ⌘휠은 native `addEventListener('wheel',{passive:false})`. **핵심 정합**: `rectWH()`가 확대된 px 반환 → 드래그 %수학 **무수정**(검증 포인트). 패닝=overflow-auto + 스페이스+드래그.
- **플로팅 텍스트 툴바**: 텍스트 단일 선택 시 블록 상단(뷰포트 레벨)에 기존 FmtToolbar 재사용. 상단 경계 넘으면 아래로 플립.
- **레이어 패널**: 배열 역순 목록(아이콘+이름+가시/잠금). 클릭=선택, 드래그=재정렬(z). 잠금/숨김은 `locked?/hidden?` 필드(2차).
- **우클릭 메뉴**: shadcn ContextMenu(admin=default shadcn). 복제/맨앞·맨뒤/그룹/삭제 재배선.
- **상태 분리**: 줌/패닝/메뉴/가이드는 `useCanvasViewport`(저장 페이로드 아님 → 자동저장 deps 제외, 뷰어 무영향).

---

## 3. 컴포넌트 / 파일 변경 지점

| 파일 | 변경 |
|---|---|
| `src/types/magazine-layout.ts` | ShapeBlock·groupId 타입, `parsePageLayout` shape 필터(필수) |
| `src/components/admin/page-editor.tsx` | 히스토리 훅, selectedIds, 마키, 다중 변환, 스마트가이드 확장, 도형 추가/속성, 단축키, 줌/패닝, 우클릭, 레이어 패널 |
| `src/components/admin/magazine-editor-shell.tsx` | 캔바식 레이아웃(좌 레일·하단 페이지 스트립), 셸 레벨 클립보드 store, split 버튼·삽입선·복제 UI |
| `src/components/public/composed-page.tsx` | `ComposedBlockBody`에 `type==='shape'` 분기(전 표면 공유) |
| `src/actions/page-actions.ts` | `createComposedPage(afterPageId)` + `applyPageOrder` 1회, `duplicatePage` 신설 |
| `src/components/admin/inline-text-editor.tsx` | Tiptap history·blur commit 정합(캔버스 히스토리와 배타) |
| `src/lib/magazine-presets.ts` *(신규)* | `PAGE_PRESETS` 코드 상수 |
| `src/hooks/useEditorHistory.ts`·`useCanvasViewport.ts` *(신규, 선택)* | 히스토리·뷰포트 상태 |

---

## 4. 단계 로드맵 (각 Phase 별 게이트)

| Phase | 산출물 | 의존 | 공수 | 수용 기준(요약) |
|---|---|---|---|---|
| **P1** | 히스토리(undo/redo) + 복제 + 페이지간 클립보드 + 단축키 + 우클릭 | — (선행 필수) | M | 드래그 1회=⌘Z 1회. ⌘C/V 페이지 간 동작. 인라인/입력 포커스 가드. 자동저장·언마운트 정합 |
| **P2a** | 멀티선택 + 마키 + Shift토글 | P1 | S~M | 마키 교차 정확, 편집중>핸들>블록>마키 가드 |
| **P2b** | 다중 정렬·분배 | P2a | S | GB 기준 6정렬 + 3개+ 균등분배 |
| **P2c** | 그룹(groupId) + 함께 이동 | P2a | M | ⌘G/⌘⇧G, 뷰어 무변경 |
| **P2d** | 다중 리사이즈 + 객체간 스마트가이드 | P2a,P2b | M~L | 다른 블록 가장자리/중심 스냅·가이드선 |
| **P3** | 도형(rect/ellipse/line) + 속성 | P1 | M(rect/ellipse만이면 S) | `parsePageLayout` 필터·ComposedBlockBody 분기, fill 화이트리스트, 뷰어 동시 렌더 |
| **P4a** | 페이지 복제 + 현재 다음 삽입 | — | S | sortOrder 유니크 무충돌(applyPageOrder 1회), 블록 id 재생성 |
| **P4b** | 레이아웃 프리셋 + split 버튼 UI | P4a | M | 빈 페이지 우선/내용 시 confirm |
| **P4c** | 사용자 템플릿 저장(2차) | P4b | M | migrate deploy 1건, sanitize 재적용 |
| **P5a** | 줌 + 패닝 | — (독립) | M | 드래그 %수학 무수정, ⌘휠 커서기준 |
| **P5b** | 플로팅 텍스트 툴바 | — | S | 텍스트 선택 시 블록 위 |
| **P5c** | 레이어 패널(재정렬·가시/잠금) | — | S~M | 드래그 z재정렬 |
| **P5d** | 요소 드래그-추가 | P3 | S~M | 레일→캔버스 드롭 좌표 %환산 |

**권장 순서**: P1 → P5a(줌·독립·최대 체감) → P4a(복제·삽입·저비용) → P2a~d → P3 → P4b/P5 나머지 → P4c.
**레이아웃 셸 전환(D6)**: P1 착수 전 또는 P1과 함께 — 좌 레일·하단 페이지 스트립·우 속성+레이어로 `magazine-editor-shell` 재구성(프로토타입 기준).

---

## 5. 전체 수용 기준 (체크리스트)
- [ ] 모든 신규 동작이 **layout v2 Block[]** 만 변경 → ComposedPage(뷰어)·스키마·서버액션 무변경(템플릿 2차 제외)
- [ ] 도형 저장/로드 왕복 무손실(`parsePageLayout` 필터 포함), 뷰어에서 동일 렌더
- [ ] undo/redo가 드래그/리사이즈/nudge를 1엔트리로 묶음, 인라인 편집과 배타
- [ ] 페이지 간 복붙·복제 시 블록 id 충돌 없음
- [ ] 새 페이지가 현재 다음에 삽입, sortOrder 유니크 무충돌
- [ ] 줌 상태에서 드래그/리사이즈/스냅 좌표 정확
- [ ] `tsc`·`eslint`·`next build` 통과, 운영 DB 마이그레이션은 템플릿(2차)만

---

## 6. 미해결 결정(구현 중 확인)
1. **다중 리사이즈 시 텍스트 `fontSizePx`** 비례 스케일 여부(GB 확대에서 글자도 키울지). — 기본: 스케일 안 함(위치/크기만), 옵션 제공 검토.
2. **스마트가이드 균등간격 배지**(↔ N%) P2 포함 vs 후순위. — 기본: 정렬선 먼저, 배지 후순위.
3. **프리셋 적용 정책** "빈 페이지 우선 / 내용 있으면 confirm 덮어쓰기"(텍스트 매핑 보존은 v1 제외). — 기본 채택.
4. **사용자 템플릿(P4c)** 범위 전역(`magazineId=null`) vs 호별, 마이그레이션 1건 동의.
5. **줌 기본 진입** 100% 고정 vs Fit 자동, 범위 25~500% 확정.
6. **레이어 잠금/숨김** P5c 1차 포함 vs 2차.
