import Link from "next/link";
import type { Article } from "@/types/article";

type ArticleCardData = Pick<
  Article,
  | "slug"
  | "title"
  | "excerpt"
  | "author"
  | "category"
  | "publishedAt"
  | "thumbnailUrl"
  | "isPremium"
>;

export function ArticleCard({ article }: { article: ArticleCardData }) {
  return (
    <Link href={`/articles/${article.slug}`} className="group block">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
        {article.thumbnailUrl ? (
          <img
            src={article.thumbnailUrl}
            alt={article.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950">
            <span className="text-lg font-bold tracking-widest text-white/80">
              STAGE
            </span>
          </div>
        )}
        {article.isPremium && (
          <span className="absolute left-2 top-2 rounded bg-[#6f5c24] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
            프리미엄
          </span>
        )}
      </div>
      <div className="mt-3">
        {article.category && (
          <span className="font-label text-[11px] font-bold uppercase tracking-[0.15em] text-[#6f5c24]">
            {article.category}
          </span>
        )}
        <h3 className="mt-1 font-semibold line-clamp-2 group-hover:underline">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="mt-1 line-clamp-2 text-sm text-gray-500">
            {article.excerpt}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
          {article.author && <span>{article.author}</span>}
          {article.publishedAt && (
            <>
              {article.author && <span>·</span>}
              <span>
                {new Date(article.publishedAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
