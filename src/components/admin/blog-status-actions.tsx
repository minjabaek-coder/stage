"use client";

import {
  publishBlogPost,
  unpublishBlogPost,
  deleteBlogPost,
} from "@/actions/blog-actions";
import type { BlogPostStatus } from "@/types/blog";
import { EntityStatusActions } from "./entity-status-actions";

export function BlogStatusActions({
  postId,
  status,
  saveFormId,
}: {
  postId: string;
  status: BlogPostStatus;
  saveFormId?: string;
}) {
  return (
    <EntityStatusActions
      entityId={postId}
      status={status}
      saveFormId={saveFormId}
      actions={{
        publish: publishBlogPost,
        unpublish: unpublishBlogPost,
        remove: deleteBlogPost,
      }}
      labels={{
        unpublishLabel: "초안으로",
        publishSuccess: "블로그 글이 발행되었습니다",
        unpublishSuccess: "블로그 글이 초안으로 변경되었습니다",
        deleteTitle: "블로그 글 삭제",
        deleteDescription:
          "이 블로그 글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      }}
    />
  );
}
