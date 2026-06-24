"use client";

import { useEffect } from "react";

export function ViewTracker({
  type,
  id,
}: {
  type: "magazine" | "blog" | "article";
  id: string;
}) {
  useEffect(() => {
    const key = `viewed:${type}:${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
  }, [type, id]);

  return null;
}
