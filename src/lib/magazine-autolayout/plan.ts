// P3-②③ 플래너: 콘텐츠 스트림 + 메타 → PageLayout[](구성형 페이지 초안).
// 결정: 첫 이미지=표지 히어로, 갤러리=단독, 인라인 이미지=사진+본문(하이브리드),
// 본문은 보수적 용량으로 문단 경계 우선 분할.
import type { ContentNode } from "./content-stream";
import type { PageLayout } from "@/types/magazine-layout";
import {
  coverPage,
  bodyPage,
  imageTextPage,
  galleryPage,
  bodyCapacity,
  textCapacity,
  IMGTEXT_BODY,
} from "./layout";

export type AutoLayoutMeta = {
  title: string;
  subtitle?: string | null;
  author?: string | null;
};

function wrap(node: ContentNode): string {
  if (node.type === "paragraph") return `<p>${node.html}</p>`;
  if (node.type === "quote") return `<blockquote>${node.html}</blockquote>`;
  if (node.type === "list") return `<ul>${node.html}</ul>`;
  return "";
}

export function planPages(
  stream: ContentNode[],
  meta: AutoLayoutMeta,
): PageLayout[] {
  const pages: PageLayout[] = [];
  const byline = meta.author ? `글·사진 | ${meta.author}` : undefined;

  // 히어로 = 첫 이미지(표지로 이동)
  const heroIdx = stream.findIndex((n) => n.type === "image");
  const hero =
    heroIdx >= 0
      ? (stream[heroIdx] as Extract<ContentNode, { type: "image" }>)
      : undefined;
  const rest = stream.filter((_, i) => i !== heroIdx);

  // 리드: 앞쪽의 짧은 첫 문단을 표지에
  let leadHtml: string | undefined;
  const fp = rest.findIndex((n) => n.type === "paragraph");
  if (fp >= 0 && fp <= 1) {
    const p = rest[fp] as Extract<ContentNode, { type: "paragraph" }>;
    if (p.text.length <= 220) {
      leadHtml = `<p>${p.html}</p>`;
      rest.splice(fp, 1);
    }
  }

  pages.push(
    coverPage({
      title: meta.title,
      subtitle: meta.subtitle ?? undefined,
      byline,
      heroSrc: hero?.src,
      leadHtml,
    }),
  );

  // 본문 흐름
  let curHtml: string[] = [];
  let curLen = 0;
  let curHeading: string | undefined;
  const cap = () => bodyCapacity(!!curHeading);
  const flush = () => {
    if (curHtml.length > 0) {
      pages.push(bodyPage({ heading: curHeading, bodyHtml: curHtml.join("") }));
    }
    curHtml = [];
    curLen = 0;
    curHeading = undefined;
  };

  const bottomCap = textCapacity(
    IMGTEXT_BODY.w,
    IMGTEXT_BODY.h,
    IMGTEXT_BODY.fontSizePx,
    IMGTEXT_BODY.lineHeight,
  );

  let i = 0;
  while (i < rest.length) {
    const node = rest[i];
    if (node.type === "heading") {
      flush();
      curHeading = node.text;
      i++;
    } else if (
      node.type === "paragraph" ||
      node.type === "quote" ||
      node.type === "list"
    ) {
      const len = node.text.length;
      if (curLen > 0 && curLen + len > cap()) flush();
      curHtml.push(wrap(node));
      curLen += len;
      i++;
    } else if (node.type === "image") {
      flush();
      // 연속 이미지(문단 없이 이어짐)는 갤러리 그리드로 3장씩 묶는다(페이지 폭주 방지).
      const run: Extract<ContentNode, { type: "image" }>[] = [node];
      let j = i + 1;
      while (j < rest.length && rest[j].type === "image") {
        run.push(rest[j] as Extract<ContentNode, { type: "image" }>);
        j++;
      }
      if (run.length >= 2) {
        for (let k = 0; k < run.length; k += 3) {
          pages.push(
            galleryPage(
              run.slice(k, k + 3).map((im) => ({ src: im.src, caption: im.caption })),
            ),
          );
        }
        i = j;
      } else {
        // 단일 인라인 이미지: 사진 상단 + 이어지는 문단을 하단 용량만큼 함께 배치(하이브리드)
        const bHtml: string[] = [];
        let bLen = 0;
        let k = i + 1;
        while (
          k < rest.length &&
          rest[k].type === "paragraph" &&
          bLen + (rest[k] as { text: string }).text.length <= bottomCap
        ) {
          const p = rest[k] as Extract<ContentNode, { type: "paragraph" }>;
          bHtml.push(`<p>${p.html}</p>`);
          bLen += p.text.length;
          k++;
        }
        pages.push(
          imageTextPage({
            src: node.src,
            caption: node.caption,
            bodyHtml: bHtml.join("") || undefined,
          }),
        );
        i = k;
      }
    } else if (node.type === "gallery") {
      flush();
      pages.push(galleryPage(node.images));
      i++;
    } else {
      i++;
    }
  }
  flush();

  return pages;
}
