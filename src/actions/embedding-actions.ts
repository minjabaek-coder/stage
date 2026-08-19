"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import {
  generateArticleEmbeddings,
  generateMagazineEmbeddings,
  generateCultureEventEmbeddings,
} from "@/lib/rag";

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
