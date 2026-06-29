import { prisma } from "@/lib/prisma";
import {
  generateArticleEmbeddings,
  generateMagazineEmbeddings,
  generateCultureEventEmbeddings,
} from "@/lib/rag";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 전체 재색인(backfill): 발행 기사 + 발행 매거진(구성형 페이지 텍스트) + 발행 문화예술.
// Voyage 레이트 한도(3 RPM 가정)를 위해 각 항목 사이 지연.
export async function POST() {
  const results: { source: string; title: string; status: string }[] = [];
  const GAP_MS = 21000;
  let first = true;
  const pace = async () => {
    if (!first) await new Promise((r) => setTimeout(r, GAP_MS));
    first = false;
  };

  // 1) 기사 (발행 + aiIndexable)
  const articles = await prisma.article.findMany({
    where: { status: "published", aiIndexable: true },
    select: { id: true, title: true },
  });
  for (const a of articles) {
    await pace();
    try {
      await generateArticleEmbeddings(a.id);
      results.push({ source: "article", title: a.title, status: "success" });
    } catch (err) {
      results.push({ source: "article", title: a.title, status: `error: ${err}` });
    }
  }

  // 2) 매거진 (발행 전체 — 비연결 구성형 페이지 텍스트)
  const magazines = await prisma.magazine.findMany({
    where: { status: "published" },
    select: { id: true, title: true },
  });
  for (const m of magazines) {
    await pace();
    try {
      await generateMagazineEmbeddings(m.id);
      results.push({ source: "magazine", title: m.title, status: "success" });
    } catch (err) {
      results.push({ source: "magazine", title: m.title, status: `error: ${err}` });
    }
  }

  // 3) 문화예술 (발행)
  const events = await prisma.cultureEvent.findMany({
    where: { status: "published" },
    select: { id: true, title: true },
  });
  for (const e of events) {
    await pace();
    try {
      await generateCultureEventEmbeddings(e.id);
      results.push({ source: "culture", title: e.title, status: "success" });
    } catch (err) {
      results.push({ source: "culture", title: e.title, status: `error: ${err}` });
    }
  }

  return NextResponse.json({
    counts: {
      articles: articles.length,
      magazines: magazines.length,
      events: events.length,
    },
    results,
  });
}
