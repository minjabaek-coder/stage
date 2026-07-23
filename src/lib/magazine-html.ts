import sanitizeHtml from "sanitize-html";

// kind=html 매거진 페이지 HTML 정제(서버, 저장 시점).
// Shadow DOM으로 렌더하므로 iframe sandbox 대신 이 정제가 1차 방어선이다:
//  - <script>·form·iframe·object 등 실행/삽입 벡터 제거, on* 이벤트 핸들러 제거(허용 목록에 없음)
//  - <style>·인라인 style·클래스는 보존(디자인 자유) — 스타일 격리는 Shadow DOM이 담당
//  - href/src 스킴을 http(s)·data·mailto로 제한(javascript: 차단)
// 매거진 HTML은 관리자만 입력하므로(신뢰 경계 내부) 이 수준으로 XSS를 충분히 방어한다.
export function sanitizeMagazineHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      // 문서 구조
      "html", "head", "body", "div", "span", "section", "article", "header", "footer",
      "main", "aside", "nav", "figure", "figcaption", "p", "br", "hr",
      // 텍스트
      "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code", "em", "strong",
      "b", "i", "u", "s", "small", "sub", "sup", "mark", "q", "cite", "time", "abbr",
      "address", "del", "ins", "wbr",
      // 리스트
      "ul", "ol", "li", "dl", "dt", "dd",
      // 표
      "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
      // 미디어 / 링크
      "a", "img", "picture", "source",
      // 스타일(디자인) — Shadow DOM으로 격리되므로 전역 오염 없음
      "style",
      // SVG(아이콘·장식)
      "svg", "g", "path", "circle", "rect", "line", "polyline", "polygon", "ellipse",
      "text", "tspan", "defs", "linearGradient", "radialGradient", "stop", "clipPath",
      "use", "symbol", "title",
    ],
    allowedAttributes: {
      "*": [
        "style", "class", "id", "align", "dir", "lang", "title", "width", "height",
        "role", "aria-label", "aria-hidden",
        // SVG 프레젠테이션 속성(무해한 스타일 계열)
        "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
        "stroke-dasharray", "d", "points", "cx", "cy", "r", "rx", "ry",
        "x", "y", "x1", "y1", "x2", "y2", "viewBox", "xmlns", "transform", "offset",
        "stop-color", "stop-opacity", "gradientUnits", "gradientTransform",
        "fill-rule", "clip-rule", "fill-opacity", "opacity", "preserveAspectRatio",
        "text-anchor", "font-size", "font-family", "font-weight", "letter-spacing",
      ],
      a: ["href", "target", "rel", "name"],
      img: ["src", "alt", "width", "height", "loading", "srcset", "sizes"],
      source: ["srcset", "media", "type", "sizes"],
    },
    allowedSchemes: ["http", "https", "data", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    // <style> 허용에 따른 경고 억제(script는 allowedTags에 없어 제거됨)
    allowVulnerableTags: true,
    // viewBox 등 대소문자 혼용 SVG 속성 보존
    parser: { lowerCaseAttributeNames: false },
  });
}
