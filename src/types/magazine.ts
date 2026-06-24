import type { Magazine, MagazinePage, MagazineTocEntry } from "@/generated/prisma/client";

export type MagazineWithPages = Magazine & {
  pages: MagazinePage[];
  tocEntries?: MagazineTocEntry[];
};

export type MagazineListItem = Magazine & {
  _count: { pages: number };
};

export type MagazineStatus = Magazine["status"];
export type MagazineContentType = Magazine["contentType"];

export type { Magazine, MagazinePage, MagazineTocEntry };
