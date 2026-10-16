import type { Frame } from "./frame";

/** what the page hands a place each frame */
export type Input = {
  /** where the pointer is over the page, -1..1 each way, eased */
  lookX: number;
  lookY: number;
  /** clicks since last frame, in pixel coordinates */
  clicks: { x: number; y: number }[];
};

export type Place = {
  /** how much the brightest pixels glow, 0 for none */
  bloom?: number;
  /** the hour it's painted at, if it has one */
  hour?: string;
  /** set by the place when a click asks to see it at the other end of the day */
  flip?: boolean;
  /** set by the place when a click asks for a fresh one of the same kind */
  reroll?: boolean;
  draw(f: Frame, t: number, dt: number, input: Input): void;
};

/** `hour` forces a particular time of day instead of the one the seed would pick */
export type PlaceMaker = (seed: number, W: number, H: number, night: boolean, hour?: "day" | "night") => Place;
