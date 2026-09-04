"use client";

import { useEffect } from "react";
import { site } from "@/lib/data";

/** the old site left a note in the console for people who peek. still does. */
export function ConsoleNote() {
  useEffect(() => {
    console.log(`%c${site.consoleNote}`, "color: tomato; font-size: 14px");
  }, []);
  return null;
}
