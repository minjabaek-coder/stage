import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/public/site-header";
import { ProfileForm } from "@/components/public/profile-form";
import { ArticleCard } from "@/components/public/article-card";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "마이페이지 | STAGE" };

export default async function MyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      article: {
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          author: true,
          category: true,
          publishedAt: true,
          thumbnailUrl: true,
          isPremium: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-[#fcf9f8] text-[#1c1b1b]">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <ProfileForm
          email={user.email}
          tier={user.tier}
          proExpiresAt={user.proExpiresAt?.toISOString() ?? null}
          name={user.name}
          interests={user.interests}
          newsletterOptIn={user.newsletterOptIn}
          eventAlertOptIn={user.eventAlertOptIn}
        />

        <section className="mt-16 border-t border-[#1c1b1b]/10 pt-10">
          <h2 className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-[#6f5c24]">
            북마크한 기사
          </h2>
          {bookmarks.length === 0 ? (
            <p className="mt-4 text-sm text-[#444748]">
              아직 북마크한 기사가 없습니다.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
              {bookmarks.map((b) => (
                <ArticleCard key={b.article.id} article={b.article} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
