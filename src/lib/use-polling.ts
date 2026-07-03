"use client";

import { useEffect, useRef } from "react";

/** Polling com pausa quando a aba está oculta e refresh imediato ao voltar. */
export function usePolling(callback: () => void | Promise<void>, intervalMs: number) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    let active = true;

    async function tick() {
      if (!active || document.hidden) return;
      await savedCallback.current();
    }

    void tick();
    const interval = setInterval(tick, intervalMs);

    function onVisible() {
      if (!document.hidden) void tick();
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
}
