import { describe, it, expect } from "vitest";
import { naturalCompare, sortByFilename } from "./natural-sort";

// 드롭한 파일의 순서가 매거진 페이지 순서가 된다(DR-C). 여기서 틀리면 한 호 전체가
// 뒤섞이고, 어드민은 100쪽을 눈으로 검수해야 한다. 경계를 못 박아둔다.

describe("naturalCompare", () => {
  const sorted = (xs: string[]) => [...xs].sort(naturalCompare);

  it("사전식의 함정 — 10이 2 앞에 오지 않는다", () => {
    expect(sorted(["10.jpg", "2.jpg", "1.jpg"])).toEqual(["1.jpg", "2.jpg", "10.jpg"]);
  });

  it("접두사가 있어도 숫자로 비교한다", () => {
    expect(sorted(["page10.webp", "page9.webp", "page100.webp"])).toEqual([
      "page9.webp",
      "page10.webp",
      "page100.webp",
    ]);
  });

  it("0으로 채운 번호와 안 채운 번호가 섞여도 같은 순서", () => {
    expect(sorted(["007.jpg", "8.jpg", "0009.jpg"])).toEqual(["007.jpg", "8.jpg", "0009.jpg"]);
  });

  it("스캔 파일에서 흔한 형태", () => {
    expect(sorted(["STAGE_39_p12.jpg", "STAGE_39_p2.jpg", "STAGE_39_p1.jpg"])).toEqual([
      "STAGE_39_p1.jpg",
      "STAGE_39_p2.jpg",
      "STAGE_39_p12.jpg",
    ]);
  });

  it("여러 숫자 구간은 앞에서부터 비교한다", () => {
    expect(sorted(["2-10.jpg", "2-2.jpg", "1-99.jpg"])).toEqual([
      "1-99.jpg",
      "2-2.jpg",
      "2-10.jpg",
    ]);
  });

  it("짧은 쪽이 앞에 온다", () => {
    expect(naturalCompare("page1", "page1a")).toBeLessThan(0);
  });

  it("대소문자를 섞어도 순서가 흔들리지 않는다", () => {
    expect(sorted(["B2.jpg", "a10.jpg", "a2.jpg"])).toEqual(["a2.jpg", "a10.jpg", "B2.jpg"]);
  });

  it("같은 이름은 0", () => {
    expect(naturalCompare("1.jpg", "1.jpg")).toBe(0);
  });

  it("숫자가 문자보다 앞", () => {
    expect(naturalCompare("2.jpg", "a.jpg")).toBeLessThan(0);
  });
});

describe("sortByFilename", () => {
  it("원본 배열을 건드리지 않는다", () => {
    const files = [{ name: "3.jpg" }, { name: "1.jpg" }];
    const out = sortByFilename(files);
    expect(out.map((f) => f.name)).toEqual(["1.jpg", "3.jpg"]);
    expect(files.map((f) => f.name)).toEqual(["3.jpg", "1.jpg"]);
  });
});
