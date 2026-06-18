"use client";

import {
  publishCultureEvent,
  unpublishCultureEvent,
  deleteCultureEvent,
} from "@/actions/culture-event-actions";
import type { CultureEventStatus } from "@/types/culture-event";
import { EntityStatusActions } from "./entity-status-actions";

export function CultureEventStatusActions({
  eventId,
  status,
  saveFormId,
}: {
  eventId: string;
  status: CultureEventStatus;
  saveFormId?: string;
}) {
  return (
    <EntityStatusActions
      entityId={eventId}
      status={status}
      saveFormId={saveFormId}
      actions={{
        publish: publishCultureEvent,
        unpublish: unpublishCultureEvent,
        remove: deleteCultureEvent,
      }}
      labels={{
        unpublishLabel: "초안으로",
        publishSuccess: "이벤트가 발행되었습니다",
        unpublishSuccess: "이벤트가 초안으로 변경되었습니다",
        deleteTitle: "이벤트 삭제",
        deleteDescription:
          "이 이벤트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      }}
    />
  );
}
