# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 절대 준수 규칙 (Absolute Rules)

> 이 두 규칙은 모든 작업에 우선한다. 상세 워크플로는 [`docs/README.md`](docs/README.md).

### 규칙 1 — 모든 파일은 프로젝트 디렉토리 안에서 관리

코드뿐 아니라 **스크린샷·임시파일·로그 등 모든 산출물**을 이 프로젝트 디렉토리 내부에 둔다. (디렉토리를 지우면 PC에 프로젝트 흔적이 남지 않게 하기 위함.)

- **임시/작업 산출물은 `.scratch/`에 쓴다** — `screenshots/`·`tmp/`·`logs/` 하위 사용. 시스템 기본 임시 경로(`%TEMP%`, `/tmp`, 기본 scratchpad 등 프로젝트 밖)를 쓰지 않는다.
- `.scratch/`·`docs/`·`ref/`·`*.png`·`backups/`·`.env*`는 git 미추적(`.gitignore`). 프로젝트 내부에 두되 GitHub엔 올리지 않는다.
- 트레이드오프: docs/ref가 GitHub에 없으므로 디렉토리 삭제 = 문서도 삭제. 기기 이동·백업은 별도 수단으로.

### 규칙 2 — 작업 시작 전·후에 docs 문서를 관리

문서-코드 드리프트를 막기 위해 **작업 전 관련 docs를 읽고, 작업 후 반영해 갱신**한다.

- **작업 전**: 관련 [`docs/spec/`](docs/spec/)·[`docs/design/`](docs/design/)을 읽어 컨텍스트·해당 항목 확인.
- **작업 후(코드 동작·구조·계약에 영향을 주는 변경에 한해 필수)**: ① 영향받은 `spec`/`design`을 **코드와 대조**해 갱신 → ② [`docs/worklog/`](docs/worklog/) 기록 → ③ 선택지에서 결정했으면 [`docs/decisions/`](docs/decisions/) → ④ [`docs/roadmap.md`](docs/spec/roadmap.md) 상태 갱신.
- 오타·포맷·주석 등 런타임/구조/계약에 영향 없는 사소한 변경은 위 4단계 생략 가능.
- **as-is 정본은 코드.** 문서가 코드와 어긋나면 문서를 코드에 맞춰 갱신한다([`docs/README.md §2`](docs/README.md)).

### 규칙 3 — 작업 브랜치는 `dev` + 배포 워크플로

로컬 GitHub 계정과 Vercel 연동 계정이 달라 **dev push 시 Vercel preview 배포가 block**되므로, 아래 흐름으로 우회한다.

- **모든 작업은 `main`에서 분기한 `dev` 브랜치에서 진행**하고 `dev`로 push한다. dev push는 preview 배포를 트리거하지 않는다 — `vercel.json`의 `git.deploymentEnabled.dev=false`. 이 설정은 `main`에 있고 `dev`가 분기로 상속한다.
- **다른 브랜치명을 임의로 만들지 않는다.** dev 외 브랜치는 preview 배포가 막히지 않아 block이 재발한다. 다른 브랜치명이 필요하면 사용자에게 확인한다(그 브랜치명도 `deploymentEnabled`에 추가 필요).
- **production 반영은 사용자가 직접**: Vercel 연동 GitHub 계정으로 `dev → main` PR을 병합해야 production 배포가 authorize된다(다른 계정 머지는 배포 authorize 실패). 병합 후 사용자가 dev 정리·main 최신화.
- **에이전트 역할**: dev 커밋·push·PR 생성까지만. `main` 병합·push는 하지 않는다.

## Commands

```bash
npm run dev          # Start dev server (Next.js 16 + Turbopack)
npm run build        # prisma generate && next build
npm run lint         # eslint
npx tsc --noEmit     # Type-check without emitting

# Database
npx prisma migrate dev --name <name>   # Create and apply migration locally
npx prisma migrate deploy              # Apply migrations to remote DB
npx prisma generate                    # Regenerate Prisma client (output: src/generated/prisma/)
```

## Environment Variables

Required in `.env.local` (never committed — in .gitignore):
- `DATABASE_URL` — PostgreSQL connection string (Supabase Transaction Pooler, port 6543, ap-northeast-2). **This points at PRODUCTION** — there is no separate dev DB.
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)
- `GEMINI_API_KEY` — Google Gemini API key. Used for BOTH AI 마에스트로(도슨트) chat AND RAG embeddings (server-side only)
- `GEMINI_MODEL` — Gemini chat model id (default `gemini-3.1-flash-lite`)
- `EMBEDDING_MODEL` — Gemini embedding model id (default `gemini-embedding-001`, outputDimensionality 1024 → `ContentChunk.vector(1024)`)
- `ANTHROPIC_API_KEY` / `VOYAGE_API_KEY` — may exist in env but are **unused** by the app code (chat + embeddings are both Gemini now)

> ⚠️ **DB safety**: `DATABASE_URL` is the live production DB. **Never run `prisma migrate dev`, `migrate reset`, or `db push`** against it — use `prisma migrate deploy` only. `BlogPostChunk` (pgvector RAG table) is created by raw SQL in a migration and is **NOT** modeled in `schema.prisma`, so `db push` will DROP it. See `docs/db/` / memory for known schema drift.

## Architecture

**STAGE** is a Korean-language digital magazine + blog platform. All UI text is in Korean.

### Stack
- **Next.js 16** (App Router, Server Components, Server Actions, Turbopack)
- **Prisma 7** with `@prisma/adapter-pg` (PostgreSQL via Supabase)
- **Supabase Storage** for file uploads (bucket: `stage_storage`)
- **Tiptap** rich text editor for blog content
- **Tailwind CSS 4** + shadcn/ui components
- **Deployed on Vercel** — all DB-querying pages use `export const dynamic = "force-dynamic"`

### Data Flow

```
Server Actions (src/actions/)  →  Prisma  →  Supabase PostgreSQL
File Uploads (API routes)      →  Supabase Storage (via src/lib/upload.ts)
```

- `src/lib/prisma.ts` — Singleton Prisma client with PrismaPg adapter
- `src/lib/supabase.ts` — Lazy-initialized Supabase client (must be lazy to avoid build-time errors on Vercel)
- `src/lib/upload.ts` — File upload/delete via Supabase Storage; validates MIME types from `src/lib/constants.ts`

### Two Content Types

**Magazines**: Multi-page image-based publications. Admin uploads page images, reorders via drag-and-drop. Public viewer uses react-pageflip for book-like reading.

**Blog Posts**: Rich text articles with Tiptap editor. Supports image upload (dialog, drag-and-drop, clipboard paste), tags, custom publish dates, slug-based URLs.

### Server Actions Pattern

All server actions in `src/actions/` follow the same pattern:
- Zod validation with Korean error messages (`zod/v4`)
- Return `{ error: string }` on failure, `{ success: true }` on success
- `redirect()` after create/delete
- `revalidatePath()` for affected routes

### Key Conventions

- **Korean UI** — All user-facing text, labels, toasts, and error messages are in Korean
- **StatusBadge** accepts `string` (not a specific enum type) to be shared between Magazine and BlogPost statuses
- **Blog content sanitization** — `sanitize-html` is used server-side before rendering with `dangerouslySetInnerHTML`
- **Prisma client** is generated to `src/generated/prisma/` (in .gitignore; generated at build time via `postinstall`)
- **`export const dynamic = "force-dynamic"`** is required on every page that queries the database (Supabase IPv6 incompatible with Vercel build servers)
- **Design spec** — The canonical design & UI/UX spec is [`docs/design/v2/`](docs/design/v2/README.md) (based on `ref/260619_work/stage_full_preview.html`). Follow v2 for all public-facing UI; it supersedes the older v1 spec, now archived at `ref/legacy/design-v1/` (git-untracked, reference only). Public content = editorial language (warm palette, Noto Serif KR headlines, sharp corners); StageOS/family/ads = purple sub-brand; admin = default shadcn. See [`docs/README.md`](docs/README.md) for the full doc index.
