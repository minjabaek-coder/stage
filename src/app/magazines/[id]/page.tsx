export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/prisma";
import { MagazineReader } from "@/components/public/magazine-reader";
import {
  MagazineEbookViewer,
  type EbookPage,
} from "@/components/public/magazine-ebook-viewer";
import { DocentChatFAB } from "@/components/public/docent-chat";
import { ViewTracker } from "@/components/public/view-tracker";
import type { Metadata } from "next";

function sanitizeArticle(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height"],
    },
  });
}

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const magazine = await prisma.magazine.findUnique({ where: { id } });

  if (!magazine || magazine.status !== "published") {
    return { title: "Not Found" };
  }

  return {
    title: `${magazine.title} | STAGE`,
    description: `STAGE Magazine: ${magazine.title}`,
  };
}

export default async function MagazineViewerPage({ params }: Props) {
  const { id } = await params;

  const magazine = await prisma.magazine.findUnique({
    where: { id },
    include: {
      pages: { orderBy: { sortOrder: "asc" } },
      tocEntries: { orderBy: { sortOrder: "asc" } },
      articles: {
        where: { status: "published" },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!magazine || magazine.status !== "published") {
    notFound();
  }

  // Web-based magazine (39호~): structured-text interactive eBook viewer
  if (magazine.contentType === "web") {
    const pages: EbookPage[] = [
      { kind: "cover" },
      { kind: "toc" },
      ...magazine.articles.map(
        (a): EbookPage => ({
          kind: "article",
          slug: a.slug,
          title: a.title,
          section: a.section || null,
          author: a.author || null,
          thumbnailUrl: a.thumbnailUrl,
          html: sanitizeArticle(a.content || ""),
        })
      ),
      { kind: "maestro" },
    ];

    return (
      <>
        <ViewTracker type="magazine" id={magazine.id} />
        <MagazineEbookViewer
          magazine={{
            id: magazine.id,
            title: magazine.title,
            issueNumber: magazine.issueNumber,
            description: magazine.description,
            coverImageUrl: magazine.coverImageUrl,
            publishedLabel: magazine.publishedAt
              ? new Date(magazine.publishedAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                })
              : null,
          }}
          pages={pages}
        />
        <DocentChatFAB />
      </>
    );
  }

  // Image-based magazine: show existing viewer
  return (
    <div className="flex h-dvh flex-col bg-gray-950" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ViewTracker type="magazine" id={magazine.id} />
      <header className="hidden md:flex h-12 flex-shrink-0 items-center justify-between px-4">
        <Link
          href="/"
          className="text-sm font-bold tracking-tight text-white"
        >
          STAGE
        </Link>
        <span className="text-sm text-gray-400">
          {magazine.title}
        </span>
      </header>
      <div className="relative flex-1 overflow-hidden">
        <MagazineReader pages={magazine.pages} tocEntries={magazine.tocEntries} />
        <div className="absolute bottom-4 left-0 right-0 flex md:hidden items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-black/50 px-4 py-1.5 text-xs text-gray-300 backdrop-blur-sm transition-colors hover:text-white"
          >
            &larr; 메인으로
          </Link>
          <Link
            href="/magazines"
            className="rounded-full bg-black/50 px-4 py-1.5 text-xs text-gray-300 backdrop-blur-sm transition-colors hover:text-white"
          >
            매거진 목록
          </Link>
        </div>
      </div>
      <div className="hidden md:flex flex-shrink-0 items-center justify-center gap-4 border-t border-white/10 py-3 px-4">
        <Link
          href="/"
          className="text-sm text-gray-400 transition-colors hover:text-white"
        >
          &larr; 메인으로
        </Link>
        <span className="text-gray-700">|</span>
        <Link
          href="/magazines"
          className="text-sm text-gray-400 transition-colors hover:text-white"
        >
          매거진 목록
        </Link>
      </div>
    </div>
  );
}
