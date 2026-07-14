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
  // 택소노미: 대분류(genre)·소분류(subCategory) — 단독기사
  genre?: string | null;
  subCategory?: string | null;
  // 썸네일 비파괴 크롭(초점+줌)
  thumbnailFocusX?: number | null;
  thumbnailFocusY?: number | null;
  thumbnailZoom?: number | null;
  // 매거진 기사 병합 노출용 — 링크 경로 오버라이드 및 호수 라벨(선택)
  href?: string;
  issueLabel?: string | null;
};

export function ArticleCard({ article }: { article: ArticleCardData }) {
  // 키커: 장르(없으면 유형, 그래도 없으면 섹션)를 골드 주요 라벨로,
  // 나머지(유형·호수)를 muted로 — 주요 라벨과 중복되는 값은 제거.
  const primary = article.genre || article.subCategory || article.category;
  const muted = [article.subCategory, article.issueLabel].filter(
    (v): v is string => Boolean(v) && v !== primary,
  );
  return (
    <Link href={article.href ?? `/articles/${article.slug}`} className="group block">
      <div className="relative aspect-video w-full overflow-hidden bg-ink-deep">
        {article.thumbnailUrl ? (
          <img
            src={article.thumbnailUrl}
            alt={article.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{
              objectPosition: `${article.thumbnailFocusX ?? 50}% ${article.thumbnailFocusY ?? 50}%`,
              ...(article.thumbnailZoom && article.thumbnailZoom !== 1
                ? { transform: `scale(${article.thumbnailZoom})` }
                : {}),
            }}
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
          {primary && (
            <span className="font-label text-[11px] font-bold uppercase tracking-[0.15em] text-gold-deep">
              {primary}
            </span>
          )}
          {muted.map((part, i) => (
            <span
              key={i}
              className="font-label text-[11px] font-semibold tracking-wide text-taupe"
            >
              {i === 0 && !primary ? part : `· ${part}`}
            </span>
          ))}
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
