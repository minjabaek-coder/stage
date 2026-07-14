# Typography — 폰트 · 타입 스케일 · 라벨 규칙 (v2)

> 🟢 v2 정본. 기준 HTML은 **한글 웹폰트(Noto 계열)를 정식 채택**해 v1의 최대 갭(G1 한글 폰트 폴백)을 해소한다.

## 1. 폰트 3역할 체계

HTML이 로드하는 폰트(Google Fonts)와 역할:

| 역할 | 폰트 | 로드 weight | 제안 변수 | 용도 |
|------|------|-------------|----------|------|
| **Headline** | **Noto Serif KR** (한글 세리프) | 300·400·600·700·900 | `--font-headline` | 로고, 매거진/기사/문화 카드 제목, 히어로 제목, 표지 STAGE 워드마크, 뉴스레터 타이틀(italic) |
| **Body** | **Noto Sans KR** (한글 산세리프) | 300·400·500·700 | `--font-body` | 본문·설명·네비·버튼·UI 텍스트 전반 |
| **Label/Meta** | **DM Mono** (라틴 모노) | 400·500 | `--font-label` | 작은 라벨·카테고리·메타·날짜·키커·코드성 표기(`VOL.39`, `AD`, `Sponsored`) |

규칙:
- **제목 = Noto Serif KR**. 한글에서도 **세리프**로 나온다(v1의 핵심 변화 — 아래 §5).
- **본문/설명/네비 = Noto Sans KR**.
- **라벨/메타 = DM Mono + (라틴은)대문자 + 넓은 자간**(§4). DM Mono는 라틴/숫자 전용이므로 **한글 라벨에는 쓰지 않는다**(아래 §4 주의).

> ⚠️ 현행 갭: v1 코드는 Newsreader(세리프, 라틴 전용) + Work Sans + Geist를 `subsets:["latin"]`로 로드 → 한글이 시스템 폴백. v2는 **Noto Serif KR / Noto Sans KR / DM Mono**로 전면 교체가 필요(🔰 신규 도입). `next/font/google`로 한글 서브셋 + 필요한 weight만, `display:swap`.

## 2. 타입 스케일 (HTML 실측 → 정본)

HTML은 `clamp()`로 반응형 크기를 쓴다. 의미 단위로 정리(px 기준):

| 토큰 | 크기(clamp) | 폰트/굵기 | 용도 | HTML |
|------|-------------|-----------|------|------|
| Display | `clamp(34,7vw,56)` | Serif 900 | 히어로 표지 STAGE 워드마크 | `.hc-logo` |
| H1 | `clamp(20,3.5vw,30)` | Serif 700 | 히어로(최신호) 제목 | `.hero-title` |
| Logo | `clamp(20,3vw,26)` | Serif 900, `-1.5px` | 헤더 STAGE 로고 | `.h-logo` |
| H2(브랜드) | `17~20` | Serif 900 | StageOS/광고 로고, 푸터 로고 | `.osw-logo`, `.ad-logo` |
| H3 | `14` | Serif italic | 뉴스레터 타이틀(*STAGE Weekly*) | `.nl-title` |
| Card title | `clamp(12,1.4vw,13.5)` | Serif 700 | 기사 카드 제목(2줄 클램프) | `.art-title` |
| Card title S | `11` | Serif 700 | 문화 카드·티켓 제목 | `.c-card-title` |
| Nav | `clamp(11,1.2vw,13)` | Sans 600 | GNB 메뉴 | `.gnb-item` |
| Body | `clamp(12,1.5vw,13.5)` | Sans 400, `line-height 1.85` | 히어로 설명 | `.hero-desc` |
| Body S | `9.5~11` | Sans | 위젯 설명, 좌측 내비 링크 | `.osw-desc`, `.lc-link` |
| Section kicker | `10` | Mono 800, `tracking .22em` UPPER | 섹션 헤더("최신 기사") | `.sec-head h2` |
| Label | `8` | Mono, `letter-spacing 2~3px` UPPER | 카테고리·위젯 타이틀·키커 | `.art-cat`, `.widget-title`, `.lc-sec-title` |
| Meta | `8~9` | Mono | 날짜(발행일), 카피라이트 | `.art-meta`, `.mc-date` |
| Nano | `7~8` | Mono | 표지 위 호수(`VOL.39`), 배지 | `.hc-vol`, `.mc-vol` |

> 라벨/메타는 `7~10px`대 모노가 많다(포털형 정보 밀도). 본문 읽기 화면(상세/뷰어)은 후속 단계에서 더 큰 본문 스케일을 별도 규정한다.

## 3. 반응형 타이포

- 제목은 `clamp(min, vw, max)`로 모바일→데스크탑 자연 확대(예: 히어로 `clamp(20px,3.5vw,30px)`).
- 라벨/메타(모노)는 보통 고정 크기.
- 입력 필드 폰트는 iOS 자동 줌 방지를 위해 `≥16px` 권장(HTML 뉴스레터 입력은 11px이라 ⚠️ — 모바일 구현 시 상향 검토).

## 4. 라벨 규칙 (에디토리얼 시그니처)

라틴/숫자 라벨·카테고리·메타에 **세 가지를 함께** 적용한다 — STAGE 룩의 핵심.

```
DM Mono + UPPERCASE + letter-spacing(1px ~ 3px)
```

| 자간 | 값 | 용도 | HTML |
|------|-----|------|------|
| `1px` | | 유틸바 텍스트, 패밀리 라벨 | `.util-left`, `.fam-a` |
| `2px` | | 카테고리 라벨, 표지 호수 | `.art-cat`, `.hc-vol` |
| `3px` | | 위젯/좌측내비/푸터 키커, OS 라벨 | `.widget-title`, `.lc-sec-title`, `.osb-label` |
| `.22em` | | 섹션 헤더 키커 | `.sec-head h2` |

**주의 (한글):**
- DM Mono와 `uppercase`는 **라틴/숫자에만** 의미가 있다. 한글 라벨(예: "카테고리", "최신 기사")은 HTML에서 **DM Mono여도 실제론 Noto Sans KR로 폴백**되어 렌더된다.
- 그래서 한글 라벨은 **Noto Sans KR + 일반/약간 넓은 자간**으로 두고, `uppercase`를 적용하지 않는다. 라틴 키커(`Past Issues`, `VOL.39`, `Coming Soon`)에만 모노+대문자+트래킹을 쓴다.
- 헤드라인 세리프는 `letter-spacing` 음수(조임, 예 로고 `-1.5px`), 라벨 모노는 양수(벌림) — 방향이 반대다.

예시:
```tsx
// 섹션 헤더 (라틴 키커는 모노 대문자, 굵은 잉크 언더라인)
<div className="sec-head">  {/* border-bottom: 2px solid #1c1b1b */}
  <h2 className="font-label text-[10px] font-extrabold uppercase tracking-[0.22em]">최신 기사</h2>
  <span className="text-[11px] text-gold-deep">전체보기 →</span>
</div>

// 카테고리 라벨(틸)
<span className="font-label text-[8px] uppercase tracking-[2px] text-teal">인터뷰</span>
```

## 5. ✅ 한글 세리프 결정 (v1 G1 갭 해소)

v1 typography는 "한글 제목까지 세리프로 갈지 vs 산세리프로 통일할지"를 **미결 결정**으로 남겼다.

> **v2 결정: 한글 제목도 세리프(Noto Serif KR)로 간다.** ✅
> 기준 HTML이 로고·히어로·카드 제목 전부를 Noto Serif KR로 렌더하며, 이것이 "종이 잡지" 에디토리얼 의도를 한글에서 완성한다.

이행 메모:
1. **헤드라인** = Noto Serif KR(300~900). 로고·큰 표제는 900, 카드 제목은 700.
2. **본문/UI** = Noto Sans KR(400 기본, 메뉴 500~600).
3. **라벨/메타** = DM Mono(라틴/숫자), 한글은 Noto Sans KR 폴백.
4. **성능**: 한글 웹폰트는 용량이 크다 → 한글 서브셋 + 필요한 weight만 + `display:swap`. Noto Serif KR 900은 특히 무거우니 로고·히어로 등 제한적으로.

## 6. 본문 가독성

- 짧은 설명문은 `line-height 1.6~1.85`(HTML `.hero-desc`는 1.85).
- 2줄 이상 제목/요약은 `-webkit-line-clamp`로 줄 수 제한(기사 카드 2줄, 티켓 제목 2줄, 최근글 2줄).
- 긴 본문(블로그/기사 상세, 39호 뷰어)의 읽기 폭·자간·`prose` 한글 처리 규칙은 **후속 단계(상세/뷰어 명세)**에서 규정한다.
