"use client";

import {
  publishArticle,
  unpublishArticle,
  deleteArticle,
} from "@/actions/article-actions";
import type { BlogPostStatus } from "@/types/blog";
import { EntityStatusActions } from "./entity-status-actions";

export function ArticleStatusActions({
  articleId,
  magazineId,
  status,
  saveFormId,
}: {
  articleId: string;
  magazineId: string;
  status: BlogPostStatus;
  saveFormId?: string;
}) {
  return (
    <EntityStatusActions
      entityId={articleId}
      status={status}
      saveFormId={saveFormId}
      actions={{
        publish: publishArticle,
        unpublish: unpublishArticle,
        remove: (id) => deleteArticle(id, magazineId),
      }}
      labels={{
        unpublishLabel: "초안으로",
        publishSuccess: "아티클이 발행되었습니다",
        unpublishSuccess: "아티클이 초안으로 변경되었습니다",
        deleteTitle: "아티클 삭제",
        deleteDescription:
          "이 아티클을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      }}
    />
  );
}
