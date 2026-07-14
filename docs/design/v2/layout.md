# Layout — 컨테이너 · 그리드 · 페이지 스캐폴드 (v2)

> 🟢 v2 정본. v1의 단일 컬럼 에디토리얼 스캐폴드를 **3컬럼 포털형 레이아웃**으로 교체한다(🔰 신규 구조).
> 모든 전폭 바·콘텐츠·푸터는 `max-width: 1380px` + `clamp(12px,3vw,32px)` 좌우 패딩을 공유한다.

## 1. 페이지 스캐폴드 (홈 기준 수직 구조)

위에서 아래로 6개 전폭 밴드가 쌓인다. 각 밴드는 자체 배경색을 가지며 내부 콘텐츠만 1380px로 정렬된다.

```
┌─ ① 유틸리티 바      (bg #1c1b1b, h 30px)               ── 전폭, 잉크 ─┐
├─ ② StageOS 배너     (bg 미드나잇 그라디언트, 닫기 가능)  ── 전폭, 서브브랜드 ─┤
├─ ③ 헤더             (bg paper/95 + blur, h 58px)        ── sticky top:0  z100 ─┤
├─ ④ 장르 서브내비    (bg #f8f5f0, h 38px)                ── sticky top:58 z99 ─┤
├─ ⑤ 3컬럼 메인       (좌 148 · 본문 1fr · 우 248, gap 20) ── pt20 pb40 ─┤
└─ ⑥ 푸터             (bg #1c1b1b)                         ── 전폭, 잉크 ─┘
```

```tsx
<div className="min-h-screen bg-paper text-ink overflow-x-hidden">
  <UtilityBar />            {/* ① 전폭 잉크 */}
  <StageOsBanner />         {/* ② 닫기 가능, 서브브랜드 */}
  <Header />               {/* ③ sticky top-0 z-[100] */}
  <GenreSubNav />          {/* ④ sticky top-[58px] z-[99] */}
  <main className="columns">…</main>   {/* ⑤ 3컬럼 */}
  <Footer />               {/* ⑥ */}
  {/* (도슨트 FAB은 HTML에 없음 — 후속 단계에서 위치 규정) */}
</div>
```

- 공통 래퍼 `.wrap` = `max-width:1380px; margin:0 auto; padding:0 clamp(12px,3vw,32px)`.
- 전폭 밴드(①②③④⑥)는 배경을 100% 폭으로 깔고, 내부 `-inner`만 1380px 정렬.
- 헤더(z100) > 장르내비(z99) 순으로 sticky 스택.

## 2. 컨테이너 폭

| 폭 | 용도 |
|----|------|
| **`1380px`** | **공개 콘텐츠 표준 폭**(유틸바·배너·헤더·장르내비·3컬럼·푸터 전부 동일) |
| 본문 읽기 폭 | 상세/뷰어 단계에서 별도 규정 |

> ⚠️ v1은 `1440px`/`7xl` 혼재였다 → v2 정본 **1380px 단일화**(확정).

## 3. 3컬럼 그리드 & 반응형 붕괴 (핵심)

```css
.columns{
  max-width:1380px; margin:0 auto; padding:20px clamp(12px,3vw,32px) 40px;
  display:grid; grid-template-columns:148px 1fr 248px; gap:20px; align-items:start;
}
@media(max-width:1100px){ .columns{grid-template-columns:1fr 240px;} .left-col{display:none;} }
@media(max-width:760px){  .columns{grid-template-columns:1fr;}      .right-col{display:none;} }
```

| 폭 | 좌측 내비 | 본문 | 우측 위젯 |
|----|----------|------|----------|
| **> 1100px** | 148px (노출) | 1fr | 248px (노출) |
| **≤ 1100px** | **숨김** | 1fr | 240px (노출) |
| **≤ 760px** | 숨김 | 1fr (단일) | **숨김** |
| **≤ 560px** | 숨김 | 본문 내부 그리드만 축소(§4) | 숨김 |

**우선순위 원칙:** 좁아질 때 **좌측 내비 먼저, 그다음 우측 위젯**을 버린다. 본문(중앙)은 끝까지 유지.

> 🔰 모바일 대응 과제: 좌측 내비(카테고리/장르/아카이브)와 우측 위젯이 모바일에서 통째로 사라진다. 핵심 탐색(장르 필터·아카이브)·핵심 위젯(티켓·뉴스레터)을 **모바일에서 어디로 보낼지**(④ 장르내비 확장? 본문 인라인 삽입? 별도 드로어?)는 후속 UX 단계에서 정한다.

### 3.1 sticky 사이드바

```css
.left-col{ position:sticky; top:110px; }   /* 헤더58+장르38+여유 */
.right-col{ position:sticky; top:110px; display:flex; flex-direction:column; gap:14px; }
```
- 두 사이드바 모두 `top:110px`(헤더+장르내비 높이 합)로 고정. 본문 스크롤 시 따라온다.

## 4. 본문(중앙) 내부 그리드

| 블록 | 그리드 | 560px 이하 |
|------|--------|-----------|
| 히어로(최신호) | `clamp(130,26%,185) 1fr`, gap `clamp(14,2.5vw,28)` | (유지, 표지 축소) |
| 기사 그리드 | `repeat(3, 1fr)`, gap `clamp(10,2vw,16)` | **2열** |
| 문화(공연·전시·교육) | `repeat(3, 1fr)`, gap `clamp(10,2vw,14)` | **1열** |
| 매거진 아카이브 | `repeat(auto-fill, minmax(clamp(80,14%,110), 1fr))`, gap `clamp(8,1.5vw,14)` | (자동) |

- 각 블록 위에 **섹션 헤더**(`.sec-head`: `2px solid #1c1b1b` 하단 보더 + 모노 키커 + "전체보기 →").

## 5. 표지/이미지 비율

| 콘텐츠 | 비율/크기 | HTML |
|--------|----------|------|
| 매거진 표지(히어로·아카이브) | `aspect-ratio:3/4` (세로 잡지 판형) | `.hero-cover`, `.mc-cover` |
| 기사 썸네일 | `aspect-ratio:3/2` | `.art-thumb` |
| 문화 카드 이미지 | 높이 `56px` | `.c-card-img` |
| 광고 배너 | 높이 `145px` | `.ad-img` |
| 티켓 썸네일 | `40×40px` | `.tk-thumb` |

- 표지/썸네일 위 그라디언트 오버레이(`linear-gradient(to top, rgba(0,0,0,.25), transparent 50%)`)로 라벨 가독성 확보.
- 이미지 부재 시 폴백: `bg-dark1~8` 그라디언트 + 중앙 이모지/STAGE 워드마크([design-tokens §1.C](./design-tokens.md)).
- hover: 표지는 `grayscale→컬러`, 카드는 `translateY(-3px)` + 제목 골드 변색.

## 6. 여백 리듬 (수직)

| 위치 | 값 |
|------|-----|
| 3컬럼 상/하 패딩 | `pt 20px / pb 40px` |
| 섹션 간 | `margin-bottom 22~24px` |
| 섹션 헤더 아래 | `mb 14px` (+ 하단 잉크 보더) |
| 위젯 사이 | `gap 14px` |
| 카드 내부 | `2~10px` |
| 푸터 상단 패딩 | `36px` |

## 7. z-index 레이어

| 요소 | z |
|------|---|
| 헤더(sticky) | `100` |
| 장르 서브내비(sticky) | `99` |
| (StageOS 배너) | 일반 흐름(닫기 시 제거) |
| 모바일 하단 탭바(fixed) | `100` ([global-chrome §6](./global-chrome.md)) |
| 도슨트 FAB / 모달 | `≥100` ([global-chrome §7](./global-chrome.md)) |

## 8. 푸터 그리드

```css
.footer-top{ max-width:1380px; display:grid; grid-template-columns:1.4fr 1fr 1fr 1fr; gap:24px; }
@media(max-width:700px){ .footer-top{ grid-template-columns:1fr 1fr; gap:20px; } }
```
- 4컬럼(로고·주소 영역이 1.4배 넓음) → 700px 이하 2컬럼. (상세 콘텐츠는 [global-chrome.md](./global-chrome.md) 푸터 절)

## 9. 모바일 레이아웃 원칙 (Phase 0 결정 반영)

- 760px↓: 단일 컬럼. 좌/우 사이드바 제거. 대체 진입점은 [global-chrome §6](./global-chrome.md):
  - **상단 장르 서브내비**(가로 스크롤) 유지 → 장르 탐색.
  - **하단 고정 탭바**(홈·매거진·공연·전시·🎼AI·메뉴) → 주 내비. "메뉴" 탭이 드로어(카테고리·아카이브·티켓·소개·인증)를 연다.
  - **도슨트 FAB**은 모바일에서 숨기고 탭바 🎼AI 탭이 대체([global-chrome §7](./global-chrome.md)).
- 560px↓: 기사 2열·문화 1열로 본문 그리드 축소.
- 전폭 바(유틸바·배너·헤더·장르내비)는 유지. 헤더 GNB는 760px↓에서 숨김(하단 탭바 대체).
- 하단 탭바가 본문을 가리므로 본문 `padding-bottom` + iOS `safe-area-inset-bottom` 보정.
