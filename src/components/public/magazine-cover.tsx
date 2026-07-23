import { ComposedPage } from "./composed-page";
import { HtmlPage } from "./html-page";
import { parsePageLayout, parseHtmlLayout } from "@/types/magazine-layout";

// 매거진 표지 표현(공통). 우선순위:
//  1) coverImageUrl 비트맵
//  2) 구성형(39호+)인데 비트맵이 없으면 page 1 layout을 ComposedPage/HtmlPage로 렌더(실제 디자인 표지)
//  3) 둘 다 없으면 'STAGE' 플레이스홀더
// 부모는 relative · overflow-hidden · group 인 박스를 제공한다(MagazineCover는 inset-0 채움).
export function MagazineCover({
  coverImageUrl,
  contentType,
  coverLayout,
  title,
  placeholderClass = "text-2xl",
}: {
  coverImageUrl: string | null;
  contentType: string;
  coverLayout?: unknown; // page 1 layout (구성형 폴백)
  title: string;
  placeholderClass?: string;
}) {
  if (coverImageUrl) {
    return (
      <img
        src={coverImageUrl}
        alt={title}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    );
  }

  if (contentType === "composed" && coverLayout) {
    const layout = parsePageLayout(coverLayout);
    if (layout) {
      return (
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]">
          <ComposedPage layout={layout} fit="cover" />
        </div>
      );
    }
    // 첫 페이지가 HTML이면 iframe 축소 렌더(coverImageUrl이 없을 때만 — 위에서 우선 처리)
    const htmlLayout = parseHtmlLayout(coverLayout);
    if (htmlLayout) {
      return (
        <div className="absolute inset-0 overflow-hidden transition-transform duration-500 group-hover:scale-[1.03]">
          <HtmlPage html={htmlLayout.html} />
        </div>
      );
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <span className={`font-headline font-black text-white/30 ${placeholderClass}`}>
        STAGE
      </span>
    </div>
  );
}
