"use client";

import { useSyncExternalStore } from "react";

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  };
};

function subscribe(callback: () => void) {
  const connection = (navigator as NavigatorWithConnection).connection;
  connection?.addEventListener?.("change", callback);
  return () => connection?.removeEventListener?.("change", callback);
}

function getSnapshot() {
  return Boolean((navigator as NavigatorWithConnection).connection?.saveData);
}

/**
 * Returns whether the user has enabled browser Save-Data mode.
 */
export function useSaveData() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
