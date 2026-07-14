# Design Tokens — 색상 · 간격 · 라운드 · 그림자 · 브레이크포인트 (v2)

> 🟢 v2 정본. 값은 기준 HTML(`stage_full_preview.html`)에서 실측 추출했다.
> 색은 세 언어([foundations §4](./foundations.md))로 나뉜다: **A 에디토리얼(웜)** · **B 서브브랜드(보라/다크)** · **C 어드민(shadcn, 별도)**.
> 코드 변경은 별도 작업. 전환 전까지 신규 코드도 아래 정확한 hex만 사용한다.

## 1. 색상 (Color)

### 1.A 에디토리얼 팔레트 (공개 콘텐츠 정본)

| 역할 | Hex | 제안 토큰 | 용도 |
|------|-----|----------|------|
| **Paper** | `#fcf9f8` | `--paper` | 페이지 바탕(웜 오프화이트) |
| **Ink** | `#1c1b1b` | `--ink` | 본문/제목 기본색, 헤더 로고, CTA 배경, 푸터 배경 |
| **Ink muted** | `#444748` | `--ink-muted` | 본문 보조(히어로 설명) |
| **Slate** | `#374151` | `--slate` | 사이드바 제목, 아카이브 연도 |
| **Taupe** | `#7a7060` | `--taupe` | 메타(공연 일자·장소), 카드 보조 |
| **Date gray** | `#9ca3af` | `--date` | 날짜 메타(기사·매거진 발행일) |
| **Gold** | `#c4a35a` | `--gold` | 밝은 강조: active 밑줄, 배지(NEW), 보더 hover, 점 장식 |
| **Gold deep** | `#6f5c24` | `--gold-deep` | 짙은 강조: hover 텍스트, "전체보기 →", active 텍스트, 서명 버튼 hover |
| **Gold text** | `#8a6820` | `--gold-text` | 골드 태그 칩 텍스트(밝은 배경 위 대비) |
| **Teal** | `#1b6b6e` | `--teal` | 인터뷰·AI·교육 강조, 틸 CTA |
| **Teal deep** | `#155558` | `--teal-deep` | 틸 CTA hover |
| **Terracotta** | `#b5431a` | `--terra` | 리뷰·티켓 강조, 티켓 CTA, "할인" |
| **Ink black (deep)** | `#0e0d0b` | `--ink-deep` | 히어로 표지 배경, AI 인라인 블록 배경(에디토리얼 다크 변주) |

**웜 서피스 (배경 단계)**

| Hex | 토큰 | 용도 |
|-----|------|------|
| `#fcf9f8` | `--paper` | 페이지 바탕 |
| `#f8f5f0` | `--surface-warm` | 장르 서브내비 바탕 |
| `#faf7f4` | `--surface-input` | 뉴스레터 입력 바탕 |
| `#ffffff` | `--widget-bg` | 우측 위젯 카드 바탕(웜 위 흰 카드) |

### 1.B 서브브랜드 팔레트 (StageOS · 패밀리 · 광고)

| 역할 | Hex | 제안 토큰 | 용도 |
|------|-----|----------|------|
| **Purple** | `#6366f1` | `--os-purple` | 주색, 그라디언트 시작, StageOS 점/로고 강조 |
| **Violet** | `#8b5cf6` | `--os-violet` | 그라디언트 끝(CTA·아이콘) |
| **Purple light** | `#a5b4fc` | `--os-purple-light` | 다크 위 라벨 텍스트(`Coming Soon` 등, 보통 `/.55~.6`) |
| **Cyan** | `#0891b2` → `#0e7490` | `--book-cyan` | Kairossebook 패밀리 로고 그라디언트 |
| **Midnight** | `#0a0f1a` ~ `#111827` | `--os-bg` | 서브브랜드 다크 배경 그라디언트 |

> 그라디언트 표준: CTA·아이콘 `linear-gradient(135deg, #6366f1, #8b5cf6)`. 배경 `linear-gradient(135deg, #0a0f1a, #111827)` + `radial-gradient` 글로우.

### 1.C 다크 그라디언트 헬퍼 (이미지 플레이스홀더)

HTML은 실제 사진이 없는 자리를 8종 다크 그라디언트(`bg-dark1`~`bg-dark8`)와 `bg-hero`로 채운다. **실서비스에서는 실제 이미지로 대체**되며, 이미지 부재 시 폴백으로만 사용한다.

| 헬퍼 | 그라디언트 |
|------|-----------|
| `bg-dark1` | `135deg, #1a2535, #0d1520` (블루) |
| `bg-dark2` | `135deg, #2a1a14, #1a0d0a` (브라운) |
| `bg-dark3` | `135deg, #1a2520, #0d1a15` (그린) |
| `bg-dark4` | `135deg, #20181a, #140e10` (와인) |
| `bg-dark5` | `135deg, #1a1a2e, #0d0d1a` (퍼플) |
| `bg-dark6` | `135deg, #1f1f1a, #14140e` (올리브) |
| `bg-dark7` | `135deg, #1a2028, #0d1520` (스틸) |
| `bg-dark8` | `135deg, #16201a, #0d1814` (포레스트) |
| `bg-hero` | radial 골드+틸 글로우 위 `#0e0d0b` (최신호 표지) |

### 1.2 투명도 변형 (자주 쓰는 패턴)

| 표현 | 의미 |
|------|------|
| `border-[#1c1b1b]/7`, `/8`, `/6`, `/5`, `/4` | 헤어라인 단계(섹션·카드·리스트 구분, 위로 갈수록 진함) |
| `bg-[#fcf9f8]/95 backdrop-blur(14px)` | 고정 헤더 반투명 유리 |
| `text-[#1c1b1b]/50`, `/45`, `/28` | 비활성/보조(네비 0.5, 좌측내비 0.45, 키커 0.28) |
| `rgba(196,163,90,.06~.13)` | 골드 옅은 배경(태그 칩·active 항목·hover) |
| `rgba(99,102,241,.12~.2)` | 서브브랜드 글로우·보더 |

### 1.3 의미 색상 (Semantic) & 카테고리/장르 색 매핑

공개 화면은 빨강/초록 상태색을 쓰지 않는다. 대신 **카테고리·장르를 색으로 약하게 코딩**한다:

| 분류 | 색 | 칩 배경 |
|------|-----|--------|
| 커버스토리/스페셜 | Gold `#8a6820` | `rgba(196,163,90,.13)` |
| 인터뷰 | Teal `#1b6b6e` | `rgba(27,107,110,.11)` |
| 리뷰 | Terracotta `#b5431a` | `rgba(181,67,26,.1)` |

> 어드민 상태 배지는 shadcn `Badge` + `StatusBadge`(문자열 기반). 상태색은 어드민에 한정.

### 1.4 토큰화 권고 (globals.css) 🔰

[globals.css](../../src/app/globals.css)의 `:root`는 기본 shadcn 무채색(`oklch`)이라 위 팔레트와 무관하다. **에디토리얼 + 서브브랜드 토큰 레이어**를 추가하고 공개 컴포넌트가 hex 대신 참조하도록 점진 전환 권장:

```css
:root {
  /* A. Editorial */
  --paper: #fcf9f8; --ink: #1c1b1b; --ink-muted: #444748;
  --slate: #374151; --taupe: #7a7060; --date: #9ca3af;
  --gold: #c4a35a; --gold-deep: #6f5c24; --gold-text: #8a6820;
  --teal: #1b6b6e; --teal-deep: #155558; --terra: #b5431a;
  --ink-deep: #0e0d0b;
  --surface-warm: #f8f5f0; --surface-input: #faf7f4; --widget-bg: #ffffff;
  /* B. Sub-brand */
  --os-purple: #6366f1; --os-violet: #8b5cf6; --os-purple-light: #a5b4fc;
  --book-cyan: #0891b2;
}
@theme inline {
  --color-paper: var(--paper); --color-ink: var(--ink);
  --color-gold: var(--gold); --color-gold-deep: var(--gold-deep);
  --color-teal: var(--teal); --color-terra: var(--terra);
  --color-os-purple: var(--os-purple); /* … */
}
```

> ⚠️ v1은 `--gold`를 `#6f5c24`(짙은 골드)로 잡았다. v2는 HTML에 맞춰 **`--gold`=밝은 `#c4a35a`, `--gold-deep`=`#6f5c24`로 재정의**한다(둘 다 쓰임). 코드 전환 시 주의.

## 2. 라운드 (Border Radius)

세 언어가 라운드를 다르게 쓴다 — 이것이 영역을 시각적으로 가르는 핵심 장치다.

| 영역 | 규칙 | HTML 근거 |
|------|------|----------|
| **A 에디토리얼 콘텐츠** | **각짐(0)**. 히어로 표지·기사 썸네일·매거진 표지·문화 카드 이미지·CTA 버튼·뉴스레터 입력 모두 사각. | `.hero-cover`, `.art-thumb`, `.hbtn` |
| A 기능 보조 | 작은 라운드 절제: 위젯 카드 `9px`, 문화 카드 `6px`, 태그 칩 `3px`, 검색 버튼 `50%`(원형) | `.widget`, `.c-card`, `.htag` |
| **B 서브브랜드** | 라운드 적극: 배너 CTA `6px`, 위젯 `9px`, OS 아이콘 `7px`, AI 인라인 `10px`, 말풍선 칩 `20px`(pill) | `.osb-cta`, `.os-widget`, `.ai-bubble` |
| **C 어드민** | shadcn 기본 `--radius: 0.625rem` | — |

> 원칙: **에디토리얼 "콘텐츠"는 직각**(잡지 판형), 기능 칩/위젯은 작은 라운드, **서브브랜드는 라운드 허용**.

## 3. 간격 & 리듬 (Spacing)

HTML은 `clamp()`로 반응형 패딩을 쓴다. 토큰화 시 아래를 기준으로:

| 맥락 | 값 | HTML |
|------|-----|------|
| 컨테이너 좌우 패딩 | `clamp(12px, 3vw, 32px)` | `.wrap`, `.header-inner` |
| 3컬럼 gap | `20px` | `.columns` |
| 컬럼 상/하 패딩 | `pt 20px / pb 40px` | `.columns` |
| 섹션 헤더 아래 | `14px` (+ 하단 `2px solid ink` 보더) | `.sec-head` |
| 섹션 간 | `22~24px` | 히어로·그리드 `margin-bottom` |
| 카드 그리드 gap | `clamp(10px,2vw,16px)`(기사), `clamp(8px,1.5vw,14px)`(매거진) | `.art-grid`, `.mag-grid` |
| 위젯 사이 | `14px` | `.right-col gap` |
| 위젯 내부 패딩 | `9~13px` | `.widget-head`, `.nl-widget` |
| 요소 내부(라벨↔제목) | `2~10px` | 카드 내부 |

> 에디토리얼 v1은 "여백을 아끼지 않는다"였으나, HTML 홈은 **포털형 정보 밀도**라 간격이 더 촘촘하다(8~24px대). 본문 읽기 화면(상세/뷰어)은 후속 단계에서 넉넉한 리듬을 별도 규정.

## 4. 그림자 & 경계 (Elevation)

- 공개 화면은 그림자를 거의 쓰지 않는다. 깊이는 색 대비·헤어라인으로.
- 허용되는 옅은 그림자: 고정 헤더 `0 2px 20px rgba(0,0,0,.05)`, 카드 hover `0 4px 16px rgba(0,0,0,.06)`.
- 구분선: **헤어라인 보더**(`rgba(28,27,27,.04~.08)`). 섹션 헤더는 예외적으로 **`2px solid #1c1b1b`**(굵은 잉크 언더라인 = 에디토리얼 시그니처).
- 고정 헤더: 그림자보다 **반투명 + 블러**(`bg-[#fcf9f8]/95 backdrop-blur(14px)`).
- 서브브랜드(B)는 **radial 글로우**로 깊이 표현(`::before` radial-gradient).

## 5. 브레이크포인트 (Responsive)

HTML은 3개의 커스텀 브레이크포인트로 3컬럼을 단계적으로 붕괴시킨다(자세한 동작은 [layout.md](./layout.md) §3).

| 폭 | 동작 |
|----|------|
| `> 1100px` | 3컬럼(좌 148 · 본문 · 우 248) 전부 노출 |
| `≤ 1100px` | **좌측 내비 숨김** → 본문 + 우측(240px) 2컬럼 |
| `≤ 760px` | **우측 사이드바 숨김** → 본문 단일 컬럼 |
| `≤ 560px` | 기사 그리드 3→2열, 문화 그리드 3→1열 |

> Tailwind 매핑: `1100px`≈커스텀(또는 `xl` 조정), `760px`≈`md`(768) 근사, `560px`≈커스텀. 구현 시 커스텀 스크린(`screens`)으로 정확히 맞추는 것을 권장.

## 6. 컨테이너 최대폭

| 값 | 용도 | HTML |
|----|------|------|
| **`1380px`** | **공개 콘텐츠 표준 폭** (유틸바·배너·헤더·3컬럼·푸터 전부 동일) | `.wrap`, `.columns`, `.footer-top` |
| 본문 읽기 폭 | (상세/뷰어 단계에서 별도 규정) | — |

> ⚠️ v1은 `1440px`(홈)/`7xl`(목록)로 불일치했다. **v2 정본 = `1380px`로 통일.** 모든 전폭 바·3컬럼·푸터가 같은 `max-width:1380px` + `clamp` 패딩을 공유한다.
