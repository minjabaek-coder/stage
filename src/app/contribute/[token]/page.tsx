export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { resolveEditToken } from "@/actions/article-token-actions";
import { ContributeEditor } from "@/components/public/contribute-editor";

// 토큰 게이트 공개 경로 — 검색 비노출.
export const metadata: Metadata = {
  title: "기고 에디터 | STAGE",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-ink/10">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <span className="font-label text-sm font-bold uppercase tracking-[0.2em]">
            STAGE
          </span>
          <span className="font-label text-[11px] uppercase tracking-wider text-taupe">
            기고 에디터
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
    </div>
  );
}

function Notice({ title, desc, href, hrefLabel }: { title: string; desc: string; href?: string; hrefLabel?: string }) {
  return (
    <div className="mt-16 border border-ink/10 bg-surface-warm p-10 text-center">
      <p className="font-headline text-2xl text-ink">{title}</p>
      <p className="mt-3 text-sm text-ink-muted">{desc}</p>
      {href && (
        <Link
          href={href}
          className="mt-6 inline-block bg-ink px-6 py-3 font-label text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-gold-deep"
        >
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}

export default async function ContributePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await resolveEditToken(token);

  if (!res.ok) {
    if (res.reason === "published") {
      return (
        <Shell>
          <Notice
            title="이미 발행되었습니다"
            desc="이 기사는 발행되어 더 이상 편집할 수 없습니다. 공개된 기사를 확인해보세요."
            href={res.slug ? `/articles/${res.slug}` : "/articles"}
            hrefLabel="발행된 기사 보기"
          />
        </Shell>
      );
    }
    return (
      <Shell>
        <Notice
          title="유효하지 않은 링크"
          desc="링크가 만료되었거나 회수되었습니다. 담당 편집자에게 문의해주세요."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <span className="font-label text-[10px] font-bold uppercase tracking-[0.25em] text-gold-deep">
        Contribute
      </span>
      <h1 className="font-headline mt-2 text-3xl font-bold tracking-tight text-ink">
        원고 작성
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        제목·본문·요약·썸네일·태그를 작성하고 저장하세요. 완료되면 제출해 편집자
        검토를 요청할 수 있습니다.
      </p>
      <div className="mt-8">
        <ContributeEditor
          token={token}
          initial={{
            title: res.article.title,
            excerpt: res.article.excerpt,
            content: res.article.content,
            thumbnailUrl: res.article.thumbnailUrl,
            tags: res.article.tags,
            status: res.article.status,
          }}
        />
      </div>
    </Shell>
  );
}
