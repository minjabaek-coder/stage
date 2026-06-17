"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type ActionResult = { error?: string; success?: boolean } | void;

export interface EntityStatusActionsProps {
  entityId: string;
  /** Current status; compared against "published" (StatusBadge string convention). */
  status: string;
  /** When set, renders a submit button bound to the external form with this id. */
  saveFormId?: string;
  actions: {
    publish: (id: string) => Promise<ActionResult>;
    unpublish: (id: string) => Promise<ActionResult>;
    remove: (id: string) => Promise<ActionResult>;
  };
  labels: {
    unpublishLabel: string;
    publishSuccess: string;
    unpublishSuccess: string;
    deleteTitle: string;
    deleteDescription: string;
  };
}

/**
 * Shared publish / unpublish / delete control for admin entities (magazines,
 * blog posts). Entity-specific server actions, toast copy and dialog text are
 * injected so the interaction logic lives in one place.
 *
 * Note: delete actions that redirect on success never resolve, so the
 * post-await error handling only runs on the failure path — which is exactly
 * the desired behavior for both magazines and blog posts.
 */
export function EntityStatusActions({
  entityId,
  status,
  saveFormId,
  actions,
  labels,
}: EntityStatusActionsProps) {
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handlePublish() {
    setLoading(true);
    const result = await actions.publish(entityId);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(labels.publishSuccess);
    }
    setLoading(false);
  }

  async function handleUnpublish() {
    setLoading(true);
    const result = await actions.unpublish(entityId);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(labels.unpublishSuccess);
    }
    setLoading(false);
  }

  async function handleDelete() {
    setLoading(true);
    const result = await actions.remove(entityId);
    if (result?.error) {
      toast.error(result.error);
      setDeleteOpen(false);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "published" && (
        <Button onClick={handlePublish} disabled={loading}>
          발행하기
        </Button>
      )}
      {status === "published" && (
        <Button variant="outline" onClick={handleUnpublish} disabled={loading}>
          {labels.unpublishLabel}
        </Button>
      )}
      {saveFormId && (
        <button
          type="submit"
          form={saveFormId}
          disabled={loading}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        >
          저장
        </button>
      )}
      <Button
        variant="destructive"
        disabled={loading}
        onClick={() => setDeleteOpen(true)}
      >
        삭제
      </Button>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.deleteTitle}</DialogTitle>
            <DialogDescription>{labels.deleteDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
