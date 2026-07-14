# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
