# 계정 · 권한 사양 (Account & Permissions)

> 📄 **사양/결정 문서.** 구현은 다음 단계(이 문서는 "무엇을 만들지"만 규정).
> 작성일 2026-06-23 · 대상 브랜치 `dev` · 운영 DB 주의(마이그레이션은 `migrate deploy`만, [CLAUDE.md](../CLAUDE.md) §DB 안전).

## 0. 한 줄 요약

계정은 **`role`(user/admin) 단일 축**으로 나눈다. **기고자는 역할이 아니라 "기사별 무계정 편집 토큰"**으로 처리한다. 기사는 `draft → 검토대기 → published`로 흐르고, **발행 시 기고자 토큰이 무효화**된다.

---

## 1. 두 개의 독립 축 — role vs tier

현재 [User](../prisma/schema.prisma#L324)에는 `tier`만 있고 `role`은 없다. 둘은 **목적이 다른 별개 축**이므로 분리한다.

| 축 | 값 | 의미 | 구동하는 것 |
|----|-----|------|------------|
| **role** (신규) | `user` · `admin` | **운영 권한** | `/admin` 접근, 기사 CRUD·발행 |
| **tier** (기존) | `guest` · `member` · `pro` | **회원 등급** | 프리미엄 게이팅, 티켓 할인, AI 질문 횟수 |

- 한 계정은 `role`과 `tier`를 **동시에** 가진다(예: `role=user, tier=pro`인 유료 독자 / `role=admin, tier=member`인 운영자).
- 관리자 판단은 **오직 `role=admin`**으로 한다. tier로 권한을 판단하지 않는다.

> ✅ 이 점에서 사용자가 제안한 **2-role(user/admin) 모델은 타당**하다. 기고자를 위한 세 번째 role은 두지 않는다(§3).

### 1.1 스키마 변경안 (구현 단계)

```prisma
enum UserRole {
  user
  admin
}

model User {
  // …기존 필드…
  role  UserRole  @default(user)   // 신규
}
```

### 1.2 관리자 부트스트랩 (최초 admin 생성)

`role` 기본값이 `user`이므로 최초 관리자를 만드는 경로가 필요하다. **결정 필요** — 권장안:
- **(A) 환경변수 허용목록** — `ADMIN_EMAILS`(쉼표 구분)에 포함된 이메일은 로그인/동기화 시 `role=admin`으로 승격. 코드로 관리, 운영 DB 직접 수정 불필요.
- (B) 수기 지정 — 알려진 관리자 이메일의 `role`을 운영 DB에서 1회 `UPDATE`. (단발성)

> 권장: **(A) 허용목록**(재현 가능·실수 적음). 단 허용목록 변경은 배포가 필요. 최종 선택은 구현 직전 확정.

---

## 2. 관리자 보호 (/admin 게이트)

현재 `/admin`은 **무인증**(메모리·HANDOFF의 보류 항목). role 도입과 함께 보호한다.

**규칙**
- `/admin/*` 진입 시 세션 → `User`(authId) 조회 → **`role !== admin`이면 차단**(비로그인 포함).
- 차단 응답: 공개 화면으로 리다이렉트 또는 404(노출 최소화). **권장: 404**(관리자 경로 존재를 숨김).
- 구현 위치 후보: `src/proxy.ts`(미들웨어) 또는 `/admin` 레이아웃의 서버 컴포넌트 가드. 기존 [auth.ts](../src/lib/auth.ts)·[supabase-server.ts](../src/lib/supabase-server.ts) 재사용.

> 🔰 미결: 차단 방식(404 vs 리다이렉트), 게이트 위치(proxy vs layout)는 구현 단계 결정. 사양상 요구는 "비-admin은 `/admin`에 도달 불가".

---

## 3. 기고자(Contributor) — 무계정 토큰 모델

기고자는 **로그인하지 않는다.** 관리자가 기사 골격(slug 포함)을 만들고 **편집 토큰 링크**를 전달하면, 기고자는 그 링크로 접속해 **저장(작성)만** 한다.

### 3.1 흐름 (해피 패스)

```
① 관리자: 기사 요청 수신(외부/제보) → 기사 생성(title 임시, slug, status=draft) + 편집 토큰 발급
② 관리자: 링크 전달  →  https://www.bon-stage.com/contribute/{token}
③ 기고자: 링크 접속(로그인 없음) → 제목·본문·요약·썸네일·태그 작성 → "저장" 반복
④ 기고자: 작성 완료 → "제출"(status=검토대기)  ※ 제출 후에도 발행 전까진 계속 수정 가능
⑤ 관리자: 검토대기 기사 확인 → 일부 수정 → 발행(status=published)
⑥ 발행 즉시: 토큰 무효화 → 기고자 링크는 "발행되었습니다" 안내 + 공개 기사 링크(편집 불가)
```

### 3.2 토큰 사양

| 항목 | 사양 |
|------|------|
| 생성 | 기사당 1개. 암호학적 난수(≥32바이트, URL-safe). 추측 불가. |
| 저장 | **해시 저장 권장**(평문 비교 대신 해시 매칭). 평문은 발급 시 1회만 노출. |
| 접근 경로 | `/contribute/{token}` — 공개 경로지만 토큰 게이트. **`noindex`(robots)**, OG 미노출. |
| 유효 조건 | `토큰 미회수` **AND** `기사 status != published`. |
| 무효화 | 발행 시 **자동 무효화**. 관리자가 **수동 회수/재발급** 가능(유출 대응). |
| 만료(선택) | 기본은 발행 전까지 유효. 필요 시 `N일` TTL 옵션(결정 보류). |

### 3.3 데이터 모델안 (구현 단계)

권장: **전용 모델**(회수·재발급 이력·감사에 유리).

```prisma
model ArticleEditToken {
  id         String    @id @default(cuid())
  articleId  String    @unique          // 기사당 1 활성 토큰
  tokenHash  String    @unique          // 해시 저장
  createdAt  DateTime  @default(now())
  expiresAt  DateTime?                  // 선택적 TTL
  revokedAt  DateTime?                  // 수동 회수
  article    Article   @relation(fields: [articleId], references: [id], onDelete: Cascade)
}
```
대안(최소): `Article`에 `editTokenHash`·`editTokenRevokedAt` 필드만 추가. 단순하나 이력/재발급 추적은 약함.

> 무계정 모델의 한계(수용): **링크 유출 시 누구나 편집 가능 · 작성자 식별 불가.** 완화책 = 해시 저장 · 발행 자동 무효화 · 수동 회수 · `noindex`. 바이라인(author)은 **관리자가 직접 설정**한다.

---

## 4. 기사 상태 라이프사이클

현재 [BlogPostStatus](../prisma/schema.prisma#L117)는 `draft/published` 2상태이며 **Article·BlogPost·CultureEvent가 공유**한다. "검토대기"를 추가하되 공유 enum 오염을 피한다.

**권장: Article 전용 enum 신설**
```prisma
enum ArticleStatus {
  draft        // 작성 중(관리자 생성 직후 / 기고자 작성)
  submitted    // 검토대기(기고자가 제출) — 기고자 편집 여전히 가능
  published    // 발행 — 기고자 토큰 무효, 공개 노출
}
// Article.status: BlogPostStatus → ArticleStatus 로 전환
```
- 대안(최소 변경): status는 `draft/published` 유지 + `submittedAt DateTime?` 파생. "검토대기" = `status=draft && submittedAt != null`. 공유 enum·기존 쿼리 무변경.

> ⚠️ 전용 enum 전환 시 영향: Article.status를 `published`로 필터하는 기존 코드(목록·RAG·사이트맵 등) 점검 필요. 두 방식의 트레이드오프(명확성 vs 변경량)는 구현 직전 확정.

**상태 전이 규칙**
- `draft → submitted`: 기고자(토큰) 또는 관리자.
- `submitted → draft`: 관리자(반려) — 선택.
- `* → published`: **관리자만.** 발행 시 `publishedAt` 설정 + 토큰 무효화 + (aiIndexable·premium 등 발행 필드 확정).
- `published → draft/submitted`(발행 취소): **관리자만**, 신중히. 취소 시 토큰 재발급 여부는 관리자 판단.

---

## 5. 편집 권한 매트릭스 (누가·언제·무엇을)

### 5.1 주체 × 상태

| 주체 | draft | 검토대기(submitted) | published |
|------|:-----:|:------------------:|:---------:|
| **기고자(토큰)** | 편집 O | 편집 O | **차단**(안내만) |
| **관리자** | 편집 O | 편집 O | 편집 O |
| **일반 user / 비로그인** | — | — | 공개 열람만 |

> 핵심: **기고자는 "발행 전까지" 편집 가능**(draft·submitted 모두). 발행이 유일한 잠금 트리거. 제출은 잠금이 아니라 관리자에게 보내는 신호.

### 5.2 필드 레벨 권한

| 필드 | 기고자 | 관리자 |
|------|:------:|:------:|
| 제목 title | ✅ | ✅ |
| 본문 content | ✅ | ✅ |
| 요약 excerpt | ✅ | ✅ |
| 썸네일 thumbnailUrl | ✅ | ✅ |
| 태그 tags | ✅ | ✅ |
| slug | ❌ | ✅ |
| status / 발행 | ❌ | ✅ |
| author(바이라인) | ❌ | ✅ |
| category | ❌ | ✅ |
| isPremium / isFeatured | ❌ | ✅ |
| aiIndexable | ❌ | ✅ |

> 관리자는 "발행·노출·정책" 필드를 독점한다. 기고자는 "원고" 필드만. (이 분배는 기본값 — 조정 가능)

---

## 6. 화면 / 라우트

| 경로 | 대상 | 내용 |
|------|------|------|
| `/admin/articles` (기존) | 관리자 | 기사 목록 + **상태 필터(검토대기 강조)** + 신규 생성(토큰 발급) |
| `/admin/articles/[id]` (기존) | 관리자 | 기사 편집(전 필드) + 발행 + 토큰 회수/재발급 + 기고자 링크 복사 |
| `/contribute/{token}` (신규 🔰) | 기고자 | 토큰 검증 → 원고 필드 편집기(제한 필드) + 저장 + 제출. 발행 후 안내 화면. |

- `/contribute`는 에디터 UI를 어드민과 공유하되 **필드 가시성/수정 가능 범위만 축소**(§5.2). 디자인은 어드민(C shadcn) 결 사용 가능.
- 관리자 화면에 **"기고자 링크" 표시·복사·회수** UI 추가.

---

## 7. 보안 · 운영 고려

- 토큰: 난수·해시 저장·`noindex`·HTTPS 전제. 무차별 추측 방지(길이 + 실패 rate-limit 선택).
- 발행 자동 무효화로 "발행 후 접근 차단" 요구를 **상태+토큰 이중**으로 보장(토큰 유효성 검사에 `status != published` 포함).
- 관리자 게이트는 **서버 측**에서 강제(클라이언트 숨김만으로 불가).
- 운영 DB 마이그레이션: `User.role`·`ArticleEditToken`·`ArticleStatus`는 추가형이라 안전하나, **반드시 `migrate deploy`** + HNSW 인덱스 보존 확인([CLAUDE.md](../CLAUDE.md) §DB).
- 기존 데이터: 현 회원 0명·Article 0건(HANDOFF) → role 기본값·status 매핑 마이그레이션 부담 낮음.

---

## 8. 미결 / 후속 결정

| # | 항목 | 비고 |
|---|------|------|
| 1 | 관리자 부트스트랩: 허용목록(A) vs 수기(B) | §1.2 — 권장 A |
| 2 | /admin 차단 방식(404 vs 리다이렉트) · 게이트 위치(proxy vs layout) | §2 |
| 3 | 상태 모델: 전용 `ArticleStatus` enum vs `submittedAt` 파생 | §4 — 권장 전용 enum |
| 4 | 토큰 데이터: 전용 모델 vs Article 필드 | §3.3 — 권장 전용 모델 |
| 5 | 토큰 TTL 적용 여부 / 수동 회수 UI 범위 | §3.2 |
| 6 | "기사 요청" 수신을 기존 [Tip(제보)](../prisma/schema.prisma#L268)와 연결할지, 관리자 임의 생성만 할지 | §3.1 ① |
| 7 | 발행 취소 시 토큰 재발급 정책 | §4 |

---

## 부록: 결정 요약 (확정됨)

- ✅ role = **user / admin** 2단 (기고자는 별도 role 아님)
- ✅ 기고자 접근 = **무계정 토큰 링크**
- ✅ 상태 = **draft → 검토대기 → published** (검토대기 신규)
- ✅ 발행 = 잠금 트리거(토큰 무효화), 발행 전까지 기고자 편집 가능
- ✅ 이번 단계 = **사양 문서만**, 구현은 다음
