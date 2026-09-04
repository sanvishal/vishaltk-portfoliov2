"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_LOOK, isLook, randomHue, type Look } from "@/lib/palette";

type Snapshot = {
  look: Look;
  hue: number;
  /** true once we've read the real values off the document, so UI can show state safely */
  ready: boolean;
  /** true after the gift has been clicked this session (hides the little "new" dot) */
  shuffled: boolean;
};

const serverSnapshot: Snapshot = { look: DEFAULT_LOOK, hue: 250, ready: false, shuffled: false };

// a tiny store around the document. the inline boot script writes first, react reads after.
let current: Snapshot | null = null;
const listeners = new Set<() => void>();

function readHue(): number {
  const n = Number.parseFloat(document.documentElement.style.getPropertyValue("--hue"));
  return Number.isFinite(n) ? n : 250;
}

function getSnapshot(): Snapshot {
  if (!current) {
    const fromDom = document.documentElement.dataset.look;
    current = {
      look: isLook(fromDom) ? fromDom : DEFAULT_LOOK,
      hue: readHue(),
      ready: true,
      shuffled: sessionStorage.getItem("shuffled") === "1",
    };
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

function applyHue(hue: number, look: Look) {
  document.documentElement.style.setProperty("--hue", String(hue));
  sessionStorage.setItem(`hue:${look}`, String(hue));
}

type LookContextValue = Snapshot & {
  setLook: (look: Look) => void;
  shuffle: () => void;
};

const LookContext = createContext<LookContextValue | null>(null);

export function LookProvider({ children }: { children: React.ReactNode }) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);

  const setLook = useCallback((next: Look) => {
    document.documentElement.dataset.look = next;
    localStorage.setItem("look", next);
    const saved = sessionStorage.getItem(`hue:${next}`);
    const hue = saved !== null ? Number(saved) : randomHue(next);
    applyHue(hue, next);
    write({ look: next, hue });
  }, []);

  const shuffle = useCallback(() => {
    const { look, hue } = getSnapshot();
    const next = randomHue(look, hue);
    applyHue(next, look);
    sessionStorage.setItem("shuffled", "1");
    write({ hue: next, shuffled: true });
  }, []);

  const value = useMemo(() => ({ ...snap, setLook, shuffle }), [snap, setLook, shuffle]);

  return <LookContext.Provider value={value}>{children}</LookContext.Provider>;
}

export function useLook() {
  const ctx = useContext(LookContext);
  if (!ctx) throw new Error("useLook needs a LookProvider above it");
  return ctx;
}
