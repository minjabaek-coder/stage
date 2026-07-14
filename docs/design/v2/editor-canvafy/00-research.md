> Stage 0 리서치 (2026-06-29). 다중 에이전트 병렬 리서치(7 에이전트, ~340k tokens)로 생성: 현재 코드 감사 + 캔바/미리캔버스/PPT/Figma 벤치마크(능력영역 5종) → 종합.
> 후속: Stage 1 명세 → Stage 2 목업 → Stage 3+ 단계 구현(각 게이트). 사용자 우선순위 = 실행취소·복사·단축키 / 멀티선택·그룹·스마트가이드 / 도형·요소 / 템플릿·레이아웃 / 새 페이지=현재 다음 삽입.

# 매거진 에디터 "캔바화" 리뉴얼 — Stage 0 리서치 보고서

## 1. 현재 상태 요약

STAGE 구성형 에디터는 **절대배치 DOM 블록 모델** 위에 서 있다. 핵심 계약은 다음과 같다.

- **데이터 모델 (`src/types/magazine-layout.ts`)**: `PageLayout = { blocks: Block[], pageBg? }`. `Block`은 `image | text` 두 종류뿐이며 `x/y/w/h`는 고정 2:3 캔버스(440×660px) 대비 **% 좌표**, `fontSizePx`는 기준폭 440 절대값. JSONB로 `MagazinePage.layout`에 저장.
- **렌더 통일**: 에디터(`page-editor.tsx`)와 뷰어(`composed-page.tsx`)가 **동일한 `layout`을 렌더**한다. 뷰어는 `ResizeObserver`로 scale을 계산하고 cqw로 글자를 비례 환산 → **"편집=뷰 일치"가 제품의 불변식**이다. 이 계약을 깨는 변경(예: Konva/fabric 도입, 트리형 그룹)은 전면 재작성을 강요하므로 채택하지 않는다.
- **상호작용**: `pointer capture` 수기 드래그/8핸들 리사이즈, `snapMove`(캔버스 `[0,50,100]%` 스냅, 임계 `SNAP=1.5%`, 분홍 가이드선 `snap.v/h`), `patch(id, partial)` 단일 갱신, 1.2s 디바운스 자동저장 + `beforeunload` 경고.
- **상태**: `useState<Block[]> blocks` + `useState pageBg` + 단일 `selectedId` + `editingId`(인라인 Tiptap). 페이지 전환 시 PageEditor는 `key`로 언마운트/리마운트.
- **페이지 관리 (`page-actions.ts`)**: `createComposedPage`는 **무조건 맨 끝**(`_max.sortOrder+1`)에 삽입. 재정렬은 `applyPageOrder`가 `(magazineId, sortOrder)` 유니크 충돌을 피하려 **2-pass raw SQL**(전부 -100000 시프트 후 재설정, P2028 대륙간 트랜잭션 한도 회피)로 처리.

**없는 것**: 실행취소/다시실행(툴바에 `disabled` 플레이스홀더만, page-editor.tsx 381행), 복사/붙여넣기/복제, 키보드 단축키(Esc 제외), 멀티선택/그룹, 도형, 템플릿, 줌/패닝, 객체-객체 스냅, 플로팅 서식 툴바, 우클릭 메뉴, 현재 위치 페이지 삽입.

---

## 2. 격차 분석 (영역별, 현재 → 목표)

| 영역 | 현재 | 목표 (벤치마크) |
|---|---|---|
| **히스토리** | 없음. `patch`가 `setBlocks`만 호출, 드래그는 pointermove마다 patch | 무제한(상한 100) 스냅샷 undo/redo. **한 동작=한 엔트리** (드래그/리사이즈/nudge는 종료 시 1엔트리로 coalescing) |
| **복제·클립보드** | 없음 | ⌘D 복제(우하단 ~10px 오프셋), 앱 내부 클립보드 ⌘C/⌘V, (선택) 페이지 간 복붙 |
| **단축키** | Esc만 | ⌘Z/⌘⇧Z, ⌘C/V/D, Del/Backspace, 방향키 nudge(1px / Shift 10px). 인라인 편집·input 포커스 시 전부 가드 |
| **멀티선택** | 단일 `selectedId`, 빈 캔버스 클릭 = 선택해제 | `selectedIds: string[]`, Shift-클릭 토글 + 마키(러버밴드) 드래그, 교차 판정(AABB) |
| **그룹** | flat 배열, 트리 없음 | `groupId?` 태그(평면 유지 → 뷰어 무변경), ⌘G/⌘⇧G, 함께 선택/이동 |
| **다중 정렬·분배** | `alignH/V`가 캔버스(0~100) 기준 단일 블록 | 선택셋 바운딩박스(GB) 기준 정렬 + 균등 분배(3개+) |
| **스마트 가이드** | 캔버스 0/50/100만 | 다른 블록의 left/center/right·top/middle/bottom 6선 스냅 + 가이드 표시 |
| **도형** | text/image만 | `type:'shape'`(rect/ellipse/line/triangle/star), fill/stroke/strokeWidth/strokeStyle/radius/shadow |
| **템플릿·레이아웃** | 빈 페이지 추가만 | 페이지 복제, 코드형 레이아웃 프리셋(표지형/2단/풀사진+캡션), (2차) 사용자 템플릿 저장 |
| **페이지 삽입 위치** | 항상 맨 끝 | **현재 페이지 다음**에 삽입(맥락 위치) |
| **캔버스 조작감** | 고정 100%, 줌 없음 | 줌(25~500%, 커서기준 ⌘휠), 스페이스+드래그 패닝, 플로팅 서식 툴바, 우클릭 메뉴, (후순위) 룰러 |

---

## 3. 구현 전략 (영역별)

전 영역 공통 원칙: **신규 캔버스 라이브러리(Konva/fabric/tldraw) 미도입.** 우리 %-절대배치 DOM + transform:scale 모델과 충돌하고 뷰어 정합을 깬다. 기존 pointer-capture 구현을 확장한다.

### 3.1 히스토리 + 복제 + 단축키
- **자료구조**: 전체 스냅샷 `Hist<T> = { past: T[]; present: T; future: T[] }`. 우리 편집 상태가 `{ blocks, pageBg }` 단일 작은 JSON이므로 커맨드 패턴은 과설계. 외부 의존 없이 `page-editor.tsx`에 ~80줄 `useReducer` 훅으로 충분(zundo/use-undo 불필요).
- **핵심 알고리즘 — commit vs amend**: `blocks`/`pageBg`를 `Doc`으로 통합. `patchLive`(amend, present만 교체·past에 안 쌓음) = onDragMove/리사이즈중/nudge중. `patchCommit`(직전 present를 past에 push, future 비움) = onDragEnd, 속성 onChange/blur, add/remove/duplicate/paste/zOrder/align, nudge keyup. → "드래그 한 번 = ⌘Z 한 번" 보장. 상한 100, src는 URL 문자열이라 스냅샷 경량.
- **복제**: `{...blk, id: uid(), x: clamp(blk.x+2.3), y: clamp(blk.y+2.3), z: maxZ+1}` (2.3%≈10px). 기존 `uid()`(34행), `maxZ` 로직 재사용.
- **클립보드**: 단일 페이지는 `useRef<Block|null>`. 페이지 간 복붙까지면 셸(`magazine-editor-shell`) 레벨 ref 또는 모듈 스코프 store(PageEditor가 `key`로 리마운트되어 로컬 ref 소실되므로).
- **단축키 가드**: `window` keydown 단일 useEffect. `if (editingId || /INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable) return;` — 인라인 Tiptap의 ⌘Z는 Tiptap StarterKit history가, 캔버스 ⌘Z는 우리 히스토리가 처리(배타적). ⌘D는 `preventDefault`(북마크 충돌).
- **뷰어 호환**: 스냅샷이 layout v2 `Block[]` 그대로 → ComposedPage·스키마·서버액션 **무변경**. UI는 381행 disabled 버튼을 `canUndo/canRedo`로 토글.

### 3.2 멀티선택·그룹·스마트가이드
- **모델 변경(최소 침습)**: `BlockBase`에 `groupId?: string` **한 필드만** 추가. `parsePageLayout`은 미인식 필드를 통과시키므로 뷰어 무변경, 39호 데이터 마이그레이션 불필요. `selectedId → selectedIds: string[]`, 속성 패널은 `length===1`일 때만 노출.
- **마키**: 빈 캔버스 onPointerDown을 "선택해제"에서 "마키 시작"으로 재정의. 종료 시 AABB 교차 `!(a.x+a.w<b.x || b.x+b.w<a.x || a.y+a.h<b.y || b.y+b.h<a.y)`. 좌표가 이미 %라 `rectWH()`(189행)로 px→% 환산 재사용.
- **다중 변환**: 선택셋 합집합 GB 계산. 이동은 dx/dy를 전원 동일 적용 + GB 기준 clamp(개별 아님). 리사이즈는 `nb.x = GB.x + (b.x-GB.x)*sx`, `nb.w=b.w*sx`. 단일 선택은 기존 `onDragMove` 유지, `length>1`만 분기.
- **다중 정렬·분배**: 다중일 때 기준을 캔버스→GB로 분기. 분배 `gap=(축길이 - Σ크기)/(n-1)` 누적 배치. 순수 함수(`getBoundingBox`/`distribute`)로 분리.
- **스마트 가이드**: `snapMove`의 `SNAP_TARGETS=[0,50,100]`(171행)을 **비선택 블록들의 left/centerX/right·top/middle/bottom + 캔버스 3타깃**으로 동적 확장. 기존 `snap.v/h` 분홍선 인프라를 `snapLines: {axis,pos}[]` 배열로 확장 재사용. 임계는 px 환산(6px→`/rectW*100`) 권장. **undo 스택 선행 필수**(파괴적 연산이 N배).

### 3.3 도형/요소
- **모델**: `ShapeBlock = BlockBase & { type:'shape'; shape:'rect'|'ellipse'|'line'|'triangle'|'star'; fill?; stroke?; strokeWidth?; strokeStyle?; radius?; shadow? }`. `parsePageLayout` 필터에 `type==='shape'` 분기 추가 **필수**(누락 시 저장된 도형이 로드 시 사라지는 회귀).
- **렌더 — 기존 div 확장(SVG 아님)**: ComposedBlockBody에 `type==='shape'` 분기 **한 곳만** 추가(에디터·뷰어·썸네일·라이트박스 6곳이 공유 → 한 곳 추가로 전 표면 일관). rect=`borderRadius`, ellipse=`borderRadius:50%`, divider=얇은 rect, fill=`background`(linear-gradient 문자열 허용), stroke=`border`. line/triangle/star만 컨테이너 안 인라인 `<svg viewBox="0 0 100 100" preserveAspectRatio="none">`.
- **제약(제품 결정)**: stroke 그라데이션 미지원(border-image와 radius 충돌, Canva도 동일). fill 문자열은 색/그라데이션 형식 화이트리스트 검증(XSS). 비정형 SVG 테두리는 `vector-effect="non-scaling-stroke"`.
- **에디터**: 툴바에 `＋도형`(5종+면 팝오버), `addShape(shape)`는 기존 `addText/addImage` 패턴(중앙 z=max+1). 우측 패널 `type==='shape'` 분기. 드래그/리사이즈/회전/정렬/z-order는 BlockBase 기반이라 **무수정 재사용**.
- **아이콘**: 1차는 기존 ImageBlock(Supabase 업로드 SVG src) 재사용. 애니메이션 스티커는 인쇄/pageflip 정합 비용으로 보류.

### 3.4 템플릿·레이아웃·페이지 삽입
- **현재 페이지 다음 삽입**: `createComposedPage(magazineId, opts?: { afterPageId?; layout? })`(무인자 호환). `afterPageId`면 INSERT 후 **`applyPageOrder`(전체 재정렬) 한 번** 호출 — 부분 UPDATE는 유니크 충돌/P2028 위험, 기존 2-pass raw SQL 재사용.
- **페이지 복제(최저비용·최고가치, 우선)**: `duplicatePage(pageId)`. layout JSONB 깊은 복사 → **전 블록 id 재생성**(원본/복제본 id 충돌 시 dnd-kit·React key·`patch(id)` 깨짐). composed의 src는 public URL이라 Storage 복사 불필요(참조 공유). `articleId=null` 기본(1:1 딥링크 "실린 곳" 중복 방지, 커밋 b495c7e).
- **레이아웃 프리셋(코드 상수, DB 불필요)**: `magazine-presets.ts`에 `PAGE_PRESETS[].build(): PageLayout`. 빈 src/플레이스홀더 html 블록 배열. % 좌표라 위치독립, `fontSizePx`는 440 기준 통일. 적용: (a) `createComposedPage(..., {layout})` (b) 빈 페이지면 `setBlocks/setPageBg` 즉시. 비어있지 않으면 `confirm` 가드(undo 미구현 시 덮어쓰기 손실). 썸네일은 ComposedPage 미니 렌더(자산 0).
- **사용자 템플릿(2차)**: `PageTemplate { id, magazineId?, name, layout, createdAt }` 신규 모델. 저장 시 `sanitizeLayout` 재적용. ⚠️ **운영 DB — `migrate deploy`만, `db push`/`migrate dev` 금지**(BlogPostChunk 드리프트).
- **UI 배선(`magazine-editor-shell`)**: 썸네일 사이 "＋ 여기에 추가"(afterPageId), ⋯메뉴 "복제". 상단 버튼을 split 버튼화(클릭=현재 다음 빈 페이지 / 드롭다운=프리셋·템플릿). 신규 생성 후 `setSelectedId(r.pageId)` 포커스.

### 3.5 캔버스 조작감 (줌/패닝/플로팅 툴바/우클릭)
- **줌(최대 ROI)**: 뷰포트(`.canvas-wrap`, overflow-auto)와 transform 레이어 분리, 레이어에 `transform:scale(zoom)`, `transformOrigin:'0 0'`. **핵심 정합**: `rectWH()`가 `getBoundingClientRect()`로 이미 확대된 px을 반환 → `(clientX-sx)/scaledWidth*100`이 정확한 %라 **드래그 수학 무수정**(검증 포인트). 커서기준 ⌘휠은 native `addEventListener('wheel',{passive:false})`(React onWheel은 passive). 보정: `scrollLeft=(scrollLeft+cursorX)*(newZoom/oldZoom)-cursorX`.
- **패닝**: 휠/트랙패드는 overflow-auto로 공짜. 스페이스+드래그 `scrollBy`만 추가.
- **플로팅 서식 툴바**: 기존 FmtToolbar 재사용, 뷰포트 레벨(transform 레이어 밖)에 `blockRect-wrapRect`로 위치 계산(역스케일 불필요). 상단 경계 넘으면 아래로 플립.
- **우클릭 메뉴**: shadcn ContextMenu(Radix, admin은 default shadcn 정책). 항목은 기존 `zOrder/alignH/V/removeSelected`+복제 재배선(저비용).
- **상태 분리**: 줌/패닝/메뉴/가이드는 `useCanvasViewport` 훅으로(저장 페이로드 아님 → 자동저장 deps에 넣지 말 것). 뷰어 무영향.

---

## 4. 단계 로드맵

| Phase | 묶음 | 의존성 | 공수 | 리스크 |
|---|---|---|---|---|
| **P1** | 히스토리(스냅샷 undo/redo) + 복제 + 클립보드 + 단축키 | 없음 (다른 모든 파괴적 기능의 선행) | **M** | 드래그 coalescing 미적용 시 히스토리 폭발. Tiptap/input 포커스 가드. 자동저장·언마운트 flush 정합. ⌘D preventDefault |
| **P2a** | 멀티선택 + 마키 | P1 권장 선행 | S~M | 빈 캔버스 pointerDown 재정의, 편집중>핸들>블록>마키 우선순위 가드 |
| **P2b** | 다중 정렬·분배 (순수 공식) | P2a | S | 좌표 round 타이밍(드래그중 raw, end에서 1회) |
| **P2c** | 그룹 태그 + 그룹 이동 | P2a | M | 뷰어 무변경(groupId만 추가) |
| **P2d** | 다중 리사이즈 + 객체간 스마트가이드 | P2a, P2b | M~L | GB 정규화/역변환, GB clamp vs 개별 최소크기(4%/3%) 충돌, 누적오차 |
| **P3** | 도형(rect/ellipse/line + 속성패널) | P1(undo 강권장, 조작 빈도↑) | **M** (rect/ellipse/line만이면 S) | `parsePageLayout` 필터 누락=데이터 소실. ComposedBlockBody 한 곳만 분기. fill 화이트리스트. strokeWidth px 스케일 |
| **P4a** | 페이지 복제 + 현재위치 삽입 | 없음 | **S** (각 ~0.5d) | sortOrder 유니크/P2028 → applyPageOrder 1회. 블록 id 재생성 필수. articleId=null |
| **P4b** | 레이아웃 프리셋 + split버튼 UI | P4a | M (~1d) | 비어있지 않은 페이지 confirm 가드. fontSizePx 440 기준 통일 |
| **P4c** | 사용자 템플릿 저장 (2차) | P4b | M (~1d) | 운영 DB migrate deploy만. sanitizeLayout 재적용 |
| **P5a** | 줌 + 패닝 | 없음 (독립, 최대 체감) | **M** | transformOrigin/rect 기준 일치, wheel passive, ⌘0/⌘= 브라우저 줌 충돌 |
| **P5b** | 플로팅 텍스트 툴바 | 없음 | S | activeEditor 이미 상위 존재 |
| **P5c** | 우클릭 메뉴 + 복제 재배선 | P1(복제) | S | — |
| **P5d** | 요소 패널 드래그-추가 | P3(도형 썸네일) | S~M | 드롭 좌표 % 환산, addText/addImage 인자화 |
| **P5e** | 룰러 (후순위) | P5a | S | 시각 노이즈 → 토글 |

**권장 실행 순서**: P1(필수 선행) → P5a 줌(독립·최대 체감, 병렬 가능) → P4a 복제·삽입(저비용 고가치) → P2a~d 멀티선택 묶음 → P3 도형 → P4b/P5 나머지 → P4c 템플릿. 사용자 우선순위(실행취소·복사·단축키 / 멀티·그룹·가이드 / 도형 / 템플릿·삽입)를 그대로 반영.

---

## 5. 미해결 결정사항 (사용자 확인 필요)

1. **클립보드 범위**: 단일 페이지 내 복붙만(useRef, 저비용)인가, **페이지 간 복붙**(셸 레벨 store, 공수↑)까지인가? + `navigator.clipboard` OS 클립보드 병행(탭 간 유지, HTTPS/권한 제약) 여부.
2. **그룹 방식 확정**: `groupId` 태그(평면·뷰어 무변경) 채택을 확정하는가? 진짜 트리 그룹은 뷰어 재귀 렌더가 필요해 비권장.
3. **도형 1차 범위**: rect/ellipse/line(CSS만, S)으로 줄일지, triangle/star(인라인 SVG, M)까지 포함할지. + stroke 그라데이션 미지원 제약 수용 여부.
4. **다중 리사이즈 시 텍스트 `fontSizePx`** 비례 스케일 여부(GB 리사이즈에서 글자도 같이 키울지).
5. **프리셋 적용 정책**: v1을 "빈 페이지 우선 / 비어있으면 confirm 덮어쓰기"로 확정하는가? (텍스트 매핑 보존은 복잡해 v1 제외 권장.)
6. **사용자 템플릿 저장(P4c)** 범위: 전역(`magazineId=null`) vs 호별. 운영 DB 마이그레이션 1건 추가 동의 필요.
7. **줌 기본 동작**: 초기 진입 시 100% 고정 vs "화면 맞춤(Fit)" 자동. 줌 범위(25~500% 제안) 확정.
8. **스마트가이드 균등간격 배지**(분홍 양방향 화살표): 1차 포함 vs 후순위 보류.

---

관련 파일(절대경로):
- `/Users/kai/Documents/Projects/Stage/stage/src/types/magazine-layout.ts` — `Block`/`PageLayout`/`parsePageLayout`(shape 필터·groupId 추가 지점)
- `/Users/kai/Documents/Projects/Stage/stage/src/components/admin/page-editor.tsx` — `patch`(81), `snapMove`(173, SNAP_TARGETS 171), `rectWH`(189), 자동저장(303~330), disabled undo 버튼(381)
- `/Users/kai/Documents/Projects/Stage/stage/src/components/admin/magazine-editor-shell.tsx` — 셸 레벨 클립보드 store·split 버튼·복제 UI 배선 지점
- `/Users/kai/Documents/Projects/Stage/stage/src/components/admin/inline-text-editor.tsx` — Tiptap history·blur commit 정합
- `/Users/kai/Documents/Projects/Stage/stage/src/components/public/composed-page.tsx` — ComposedBlockBody shape 분기(전 표면 공유)
- `/Users/kai/Documents/Projects/Stage/stage/src/actions/page-actions.ts` — `createComposedPage`(31, afterPageId 확장), `applyPageOrder`(77, 2-pass raw SQL 재사용), `duplicatePage` 신설 지점