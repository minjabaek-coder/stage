"use client";

import {
  publishMagazine,
  unpublishMagazine,
  deleteMagazine,
} from "@/actions/magazine-actions";
import type { MagazineStatus } from "@/types/magazine";
import { EntityStatusActions } from "./entity-status-actions";

export function StatusActions({
  magazineId,
  status,
  saveFormId,
}: {
  magazineId: string;
  status: MagazineStatus;
  saveFormId?: string;
}) {
  return (
    <EntityStatusActions
      entityId={magazineId}
      status={status}
      saveFormId={saveFormId}
      actions={{
        publish: publishMagazine,
        unpublish: unpublishMagazine,
        remove: deleteMagazine,
      }}
      labels={{
        unpublishLabel: "미발행",
        publishSuccess: "매거진이 발행되었습니다",
        unpublishSuccess: "매거진이 미발행 처리되었습니다",
        deleteTitle: "매거진 삭제",
        deleteDescription:
          "이 매거진을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      }}
    />
  );
}
