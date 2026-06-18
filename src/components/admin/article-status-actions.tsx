"use client";

import {
  publishArticle,
  unpublishArticle,
  deleteArticle,
} from "@/actions/article-actions";
import type { ArticleStatus } from "@/types/article";
import { EntityStatusActions } from "./entity-status-actions";

export function ArticleStatusActions({
  articleId,
  status,
  saveFormId,
}: {
  articleId: string;
  status: ArticleStatus;
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
        remove: deleteArticle,
      }}
      labels={{
        unpublishLabel: "초안으로",
        publishSuccess: "기사가 발행되었습니다",
        unpublishSuccess: "기사가 초안으로 변경되었습니다",
        deleteTitle: "기사 삭제",
        deleteDescription:
          "이 기사를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      }}
    />
  );
}
