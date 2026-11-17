"use client";

import { useEffect, useState } from "react";

type NavigatorHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

let supported: boolean | undefined;

function isConstrainedDevice(): boolean {
  const nav = navigator as NavigatorHints;
  if (nav.connection?.saveData) return true;
  if (
    typeof nav.hardwareConcurrency === "number" &&
    nav.hardwareConcurrency <= 2
  ) {
    return true;
  }
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) {
    return true;
  }
  return false;
}

export function useWebGlSupport() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (supported === undefined) {
        if (isConstrainedDevice()) {
          supported = false;
        } else {
          try {
            const context = document
              .createElement("canvas")
              .getContext("webgl2");
            supported = !!context;
            context?.getExtension("WEBGL_lose_context")?.loseContext();
          } catch {
            supported = false;
          }
        }
      }
      setAvailable(supported);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return available;
}
