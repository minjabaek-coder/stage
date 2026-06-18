"use client";

import { useEffect, useRef } from "react";

// AdSlot가 광고를 렌더하면 마운트 시 1회 노출(impression)을 기록한다.
export function AdImpression({ id }: { id: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    fetch(`/api/ads/${id}/impression`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [id]);
  return null;
}
