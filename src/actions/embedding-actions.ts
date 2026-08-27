"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import {
  generateArticleEmbeddings,
  generateMagazineEmbeddings,
  generateCultureEventEmbeddings,
  buildMagazineChunks,
  indexChunkSlice,
} from "@/lib/rag";

/** 한 번의 요청에서 임베딩할 청크 수. 무료 한도(분당 100건)의 절반으로 잡아 여유를 둔다. */
const SLICE_SIZE = 50;

export type IndexSourceType = "article" | "magazine" | "culture";

// 소스 1건 재색인 (roadmap S1-3).
// 색인은 지금까지 발행·저장의 부수효과로만 돌아, 실패하면 알 방법도 되돌릴 방법도 없었다.
// 이 액션이 어드민에서 수동으로 다시 돌리는 유일한 경로다.
export async function reindexSource(type: IndexSourceType, id: string) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" as const };
  if (!id) return { error: "대상이 올바르지 않습니다" as const };

  try {
    if (type === "article") await generateArticleEmbeddings(id);
    else if (type === "magazine") await generateMagazineEmbeddings(id);
    else if (type === "culture") await generateCultureEventEmbeddings(id);
    else return { error: "알 수 없는 소스 종류입니다" as const };
  } catch (err) {
    console.error(`[RAG] manual reindex failed (${type}/${id}):`, err);
    // 원인을 어드민 화면에 그대로 보여준다 — 지금까지는 서버 로그에만 남아 보이지 않았다.
    return { error: `색인 실패: ${err instanceof Error ? err.message : String(err)}` };
  }

  revalidatePath("/admin/ai-index");
  return { success: true as const };
}

/**
 * 매거진을 **조각으로 나눠** 색인한다. 화면이 `next`가 null이 될 때까지 반복 호출한다.
 *
 * 저장할 때 자동으로 색인하지 않는 이유: 무료 임베딩 한도가 분당 100건이라 청크가
 * 100개를 넘는 호(발행분의 33%)는 요청 하나로 끝낼 수 없다. 예전에는 그런 호를
 * 저장하면 "색인 실패"만 뜨고 되돌릴 방법이 없었다 — 이제 색인은 별도 버튼이고,
 * 나눠 처리하며 진행률을 보여준다.
 */
export async function indexMagazineSlice(id: string, offset: number) {
  if (!(await isAdmin())) return { error: "권한이 없습니다" as const };
  if (!id) return { error: "대상이 올바르지 않습니다" as const };

  try {
    const built = await buildMagazineChunks(id);
    if (!built) return { error: "매거진을 찾을 수 없습니다" as const };
    if (built.chunks.length === 0) {
      // 발행 전이거나 색인할 텍스트가 없음 → 기존 청크만 정리한다.
      await indexChunkSlice("magazine", id, built.baseHref, built.baseTitle, [], 0, SLICE_SIZE);
      revalidatePath("/admin/ai-index");
      return { success: true as const, next: null, total: 0, done: 0 };
    }

    const { next, total } = await indexChunkSlice(
      "magazine",
      id,
      built.baseHref,
      built.baseTitle,
      built.chunks,
      Math.max(0, offset),
      SLICE_SIZE,
    );
    if (next === null) revalidatePath("/admin/ai-index");
    return { success: true as const, next, total, done: next ?? total };
  } catch (err) {
    console.error(`[RAG] magazine slice index failed (${id}@${offset}):`, err);
    return {
      error: `색인 실패: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
