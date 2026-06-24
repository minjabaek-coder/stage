import Link from "next/link";
import type { Article } from "@/types/article";
import { formatKSTDate } from "@/lib/format";

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
> & {
  // 매거진 기사 병합 노출용 — 링크 경로 오버라이드 및 호수 라벨(선택)
  href?: string;
  issueLabel?: string | null;
};

export function ArticleCard({ article }: { article: ArticleCardData }) {
  return (
    <Link href={article.href ?? `/articles/${article.slug}`} className="group block">
      <div className="relative aspect-video w-full overflow-hidden bg-ink-deep">
        {article.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.thumbnailUrl}
            alt={article.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-headline text-lg font-black tracking-widest text-white/30">
              STAGE
            </span>
          </div>
        )}
        {article.isPremium && (
          <span className="absolute left-2 top-2 bg-gold-deep px-1.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider text-white">
            프리미엄
          </span>
        )}
      </div>
      <div className="mt-3">
        <span className="flex items-center gap-1.5">
          {article.category && (
            <span className="font-label text-[11px] font-bold uppercase tracking-[0.15em] text-gold-deep">
              {article.category}
            </span>
          )}
          {article.issueLabel && (
            <span className="font-label text-[11px] font-semibold tracking-wide text-taupe">
              · {article.issueLabel}
            </span>
          )}
        </span>
        <h3 className="mt-1 line-clamp-2 font-semibold text-ink transition-colors group-hover:text-gold-deep">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted">
            {article.excerpt}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-sm text-taupe">
          {article.author && <span>{article.author}</span>}
          {article.publishedAt && (
            <>
              {article.author && <span className="text-taupe/50">·</span>}
              <span className="font-label text-xs tracking-wide text-date">
                {formatKSTDate(article.publishedAt)}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
