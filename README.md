# STAGE

**공연예술을 다루는 한국어 회원제 디지털 매거진 + AI 도슨트 플랫폼.**
종이 잡지의 에디토리얼 품격을 디지털에서 재현하고, 그 위에 콘텐츠를 학습한 AI 마에스트로(도슨트)를 얹었다. 축적된 데이터는 향후 SaaS 플랫폼 **StageOS**의 자산으로 재활용한다.

> 운영: https://www.bon-stage.com · 발행기획: 아트컴퍼니본 · AI 기술 파트너: (주)카이로스

---

## 핵심 기능

| 도메인 | 설명 |
|--------|------|
| **매거진** | 1~38호는 완성 이미지(WebP) eBook, 39호+는 구성형 자유배치 레이아웃. react-pageflip 넘김 뷰어. 페이지↔기사 연결("실린 곳"), 규칙 기반 자동초안. |
| **기사(Article)** | 단독 아티클. 2축 택소노미(장르×형식), 프리미엄 게이팅, 기고자 무계정 편집 토큰(`/contribute/{token}`), 북마크. |
| **AI 마에스트로** | Gemini function-calling 기반 에이전틱 RAG 도슨트. 통합 코퍼스(기사·매거진·문화예술)에서 의미 검색 + 출처 제시. 등급별 질문 한도. |
| **문화예술** | 공연·전시·교육 이벤트, 티켓 할인. |
| **회원** | 2축 권한 — `role`(user/admin, 운영) × `tier`(guest/member/pro, 등급). Supabase Auth(이메일). |
| **운영/수익화** | 관리자 CMS, 광고(노출/클릭 트래킹), 문의·제보 수신함, StageOS 랜딩. |

## 기술 스택

- **Next.js 16** (App Router · Server Components · Server Actions · Turbopack)
- **Prisma 7** + `@prisma/adapter-pg` → **Supabase PostgreSQL** (pgvector RAG)
- **Supabase** Auth + Storage
- **Google Gemini** — 챗 + 임베딩(`gemini-embedding-001`, 1024dim)
- **Tiptap** 리치 텍스트 · **Tailwind CSS 4** + shadcn/ui · **Vercel** 배포

## 시작하기

```bash
npm install            # postinstall이 prisma generate 실행 (→ src/generated/prisma/)
npm run dev            # 개발 서버 (Next 16 + Turbopack)
npm run build          # prisma generate && next build
npm run lint           # eslint
npx tsc --noEmit       # 타입 체크
```

### 환경 변수 (`.env.local`, 커밋 금지)

키 목록만 — 값은 절대 커밋하지 않는다. 상세는 [`CLAUDE.md`](CLAUDE.md) 참조.

```
DATABASE_URL                     # Supabase PostgreSQL (Transaction Pooler, 6543) — 운영 DB
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # 서버 전용
GEMINI_API_KEY                   # 챗 + 임베딩
GEMINI_MODEL                     # 기본 gemini-3.1-flash-lite
EMBEDDING_MODEL                  # 기본 gemini-embedding-001
```

> ⚠️ **DB 안전**: `DATABASE_URL`은 **운영 DB 직결**(별도 dev DB 없음). `prisma migrate dev`/`reset`/`db push` **금지** — `migrate deploy`만 사용. 상세는 [`CLAUDE.md`](CLAUDE.md).

## 프로젝트 구조

```
src/
  actions/       # Server Actions (Zod 검증 → revalidate)
  app/           # App Router — 공개 라우트 + /admin + /api
  components/    # public / admin / layouts / ui
  lib/           # prisma·supabase·auth·rag·embeddings·maestro-tools 등
  generated/     # Prisma 클라이언트 (빌드 시 생성, gitignore)
prisma/          # schema.prisma + 마이그레이션
```

## 배포 · 브랜치 워크플로

- 작업은 `main`에서 분기한 **`dev` 브랜치**에서 진행하고 `dev`로 push한다. dev push는 Vercel preview 배포를 트리거하지 않는다(`vercel.json`).
- **production 반영**: Vercel 연동 GitHub 계정으로 `dev → main` PR을 병합한다.
- 상세 규약은 [`CLAUDE.md`](CLAUDE.md) §절대 준수 규칙.

## 문서

프로젝트 상세 문서(요구사항·디자인 명세·의사결정·작업이력)는 **로컬 `docs/`** 에서 관리한다(내부 기획 문서로 git 미추적). 코드 작업 규약은 [`CLAUDE.md`](CLAUDE.md)가 정본이다.

---

*STAGE는 UI 전체가 한국어인 문화예술 콘텐츠 플랫폼이다.*
