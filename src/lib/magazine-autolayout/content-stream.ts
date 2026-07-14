// P3-① 본문 파서: 기사 HTML(Tiptap 저장형)을 순서 있는 콘텐츠 스트림으로 분해.
// 인라인 서식(strong/em/a 등)은 유지하고 블록 단위만 노드로 나눈다.
// 저장형 기준: 캡션 이미지 = <img data-caption>(figure 아님), 갤러리 = <div class="article-gallery" data-gallery>.
import { parseDocument } from "htmlparser2";
import { textContent } from "domutils";
import render from "dom-serializer";
import type { ChildNode, Element } from "domhandler";

export type ContentNode =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; html: string; text: string }
  | { type: "list"; html: string; text: string }
  | { type: "quote"; html: string; text: string }
  | { type: "image"; src: string; caption: string }
  | { type: "gallery"; images: { src: string; caption: string }[] };

function isElement(n: ChildNode): n is Element {
  return n.type === "tag";
}

function innerHtml(el: Element): string {
  return render(el.children, { decodeEntities: false }).trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// 길이 추정·표시용 순수 텍스트(엔티티 정리). html 필드는 원형 유지.
function text(el: Element): string {
  return decodeEntities(textContent(el)).replace(/\s+/g, " ").trim();
}

// <div class="article-gallery" data-gallery='[...]'> → 이미지 배열
function parseGallery(el: Element): { src: string; caption: string }[] {
  const raw = el.attribs["data-gallery"];
  if (!raw) return [];
  try {
    const arr = JSON.parse(decodeEntities(raw));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((im) => im && typeof im.src === "string")
      .map((im) => ({ src: String(im.src), caption: String(im.caption ?? "") }));
  } catch {
    return [];
  }
}

// 요소 하위(또는 자신)에서 첫 img를 찾아 image 노드로. Tiptap Image는 블록이라 보통 최상위.
function toImageNode(el: Element): ContentNode | null {
  const img =
    el.name === "img"
      ? el
      : (el.children.find((c) => isElement(c) && c.name === "img") as
          | Element
          | undefined);
  if (!img || !img.attribs.src) return null;
  let cap = img.attribs["data-caption"] ?? "";
  if (!cap && el.name !== "img") {
    const fc = el.children.find(
      (c) => isElement(c) && c.name === "figcaption",
    ) as Element | undefined;
    if (fc) cap = text(fc);
  }
  return {
    type: "image",
    src: img.attribs.src,
    caption: decodeEntities(cap).trim(),
  };
}

export function parseContentStream(html: string): ContentNode[] {
  const doc = parseDocument(html, { decodeEntities: false });
  const out: ContentNode[] = [];

  for (const node of doc.children) {
    if (!isElement(node)) continue;
    const name = node.name.toLowerCase();
    const cls = node.attribs.class ?? "";

    if (/^h[1-6]$/.test(name)) {
      const t = text(node);
      if (t) out.push({ type: "heading", level: Number(name[1]), text: t });
    } else if (name === "p") {
      const t = text(node);
      if (t) out.push({ type: "paragraph", html: innerHtml(node), text: t });
    } else if (name === "ul" || name === "ol") {
      const t = text(node);
      if (t) out.push({ type: "list", html: innerHtml(node), text: t });
    } else if (name === "blockquote") {
      const t = text(node);
      if (t) out.push({ type: "quote", html: innerHtml(node), text: t });
    } else if (name === "div" && cls.includes("article-gallery")) {
      const images = parseGallery(node);
      if (images.length) out.push({ type: "gallery", images });
    } else if (name === "img" || name === "figure") {
      const img = toImageNode(node);
      if (img) out.push(img);
    }
    // 그 외 태그는 무시(초안이므로 관대)
  }

  return out;
}
