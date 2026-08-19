import { describe, it, expect } from "vitest";
import { chunkBlogContent } from "./chunker";

// RAG 코퍼스를 만드는 지점. 여기가 바뀌면 **전체 재색인**이 필요하므로 동작을 고정해 둔다.
// (decisions/0003 · roadmap BL-3에서 개선 예정 — 그때 이 테스트가 변화를 드러낸다)

describe("chunkBlogContent", () => {
  it("너무 짧은 입력은 통째로 버린다 — 조용히 색인에서 빠지는 경계", () => {
    expect(chunkBlogContent("짧음", "제목")).toEqual([]);
    expect(chunkBlogContent("", "제목")).toEqual([]);
  });

  it("모든 청크에 제목을 붙인다(검색 맥락 보강)", () => {
    const out = chunkBlogContent("<p>" + "본문 문장입니다. ".repeat(10) + "</p>", "STAGE 1호");
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((c) => c.content.startsWith("[STAGE 1호] "))).toBe(true);
    expect(out.every((c) => c.title === "STAGE 1호")).toBe(true);
  });

  it("chunkIndex는 0부터 순서대로", () => {
    const out = chunkBlogContent("<p>" + "긴 본문입니다. ".repeat(200) + "</p>", "제목");
    expect(out.length).toBeGreaterThan(1);
    expect(out.map((c) => c.chunkIndex)).toEqual(out.map((_, i) => i));
  });

  it("HTML 태그는 제거하고 텍스트만 남긴다", () => {
    const out = chunkBlogContent("<p>광림아트센터 <b>장천홀</b>에서 공연되었습니다.</p>", "제목");
    expect(out[0].content).toContain("광림아트센터 장천홀");
    expect(out[0].content).not.toContain("<b>");
  });

  it("평문(원문 구간)도 처리한다 — 이미지형 코퍼스가 이 경로로 들어온다", () => {
    const plain = "발행인 인사말\n\n" + "스테이지란 무대를 뜻합니다. ".repeat(5);
    const out = chunkBlogContent(plain, "STAGE 1호 · 발행사");
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].content).toContain("스테이지란 무대를 뜻합니다");
  });

  it("문단 경계가 보존된다(닫는 블록 태그 → 개행)", () => {
    // 문단이 뭉개지면 청킹 단위가 무의미해진다(과거 실제로 그랬던 부분).
    // 20자 미만은 통째로 버려지므로(위 테스트) 문단을 충분히 길게 둔다.
    const out = chunkBlogContent(
      "<p>첫 문단입니다. 여기까지가 첫 번째 이야기입니다.</p><p>둘째 문단입니다. 다른 이야기가 이어집니다.</p>",
      "제목",
    );
    expect(out).not.toHaveLength(0);
    expect(out[0].content).toContain("첫 문단입니다.");
    expect(out[0].content).toContain("둘째 문단입니다.");
    // 문단 사이에 경계(공백)가 남아야 한다 — 붙어버리면 안 된다
    expect(out[0].content).not.toContain("이야기입니다.둘째");
  });
});
