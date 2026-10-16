"use client";

import { useSyncExternalStore } from "react";

/**
 * the theme lives on <html> as data-theme, written by the boot script before first paint.
 * this is the small store react reads it through.
 */

export type Theme = "light" | "dark";
type Snapshot = { theme: Theme | null };

const serverSnapshot: Snapshot = { theme: null };
let current: Snapshot | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): Snapshot {
  if (!current) {
    current = { theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light" };
  }
  return current;
}

function write(patch: Partial<Snapshot>) {
  current = { ...getSnapshot(), ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePageState() {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {}
  write({ theme });
}
