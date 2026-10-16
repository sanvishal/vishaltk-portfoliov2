import { isErdtree } from "./erdtree";
import { fields } from "./fields";
import { forest } from "./forest";
import { island } from "./island";
import { koi } from "./koi";
import { oddity } from "./oddities";
import { orbit } from "./orbit";
import { rain } from "./rain";
import type { PlaceMaker } from "./scene";
import { seaside } from "./seaside";

type PlaceKind = {
  make: PlaceMaker;
  name: string;
  /** what a click does there, in one word; some places say different things for different numbers */
  click: string | ((seed: number) => string);
  /** the film a place tips its hat to, if it does */
  nod?: (seed: number) => string | null;
};

/** the places, in the order "another place" walks through them. a seed picks one by its remainder. */
export const PLACES: PlaceKind[] = [
  { make: seaside, name: "Seaside", click: "Ripple" },
  { make: rain, name: "Rainy street", click: "Lightning" },
  {
    make: fields,
    name: "Flower fields",
    click: (seed) => (isErdtree(seed) ? "Grace" : "Gust"),
    nod: (seed) => (isErdtree(seed) ? "Elden Ring" : null),
  },
  { make: forest, name: "Spirit forest", click: "Rattle", nod: () => "Princess Mononoke" },
  { make: koi, name: "Koi pond", click: "Feed" },
  {
    make: orbit,
    name: "Low orbit",
    click: (seed) => {
      const odd = oddity(seed);
      return odd === "bagel" ? "Jump" : odd === "gargantua" ? "Dilate" : "Spin";
    },
    nod: (seed) => {
      const odd = oddity(seed);
      return odd === "bagel" ? "Everything Everywhere All at Once" : odd === "gargantua" ? "Interstellar" : null;
    },
  },
  { make: island, name: "Island map", click: "Redraw" },
];

export const SEED_MAX = 9999;

export const placeFor = (seed: number) => PLACES[seed % PLACES.length];

/** what a click does at this place, in one word */
export const clickFor = (seed: number) => {
  const { click } = placeFor(seed);
  return typeof click === "function" ? click(seed) : click;
};

/** the film this place is a nod to, if any */
export const nodFor = (seed: number) => placeFor(seed).nod?.(seed) ?? null;

/** the page always opens on the flower fields: a random field, but always a field */
export function firstSeed() {
  const kind = PLACES.findIndex((p) => p.make === fields);
  for (;;) {
    const base = Math.floor(Math.random() * (SEED_MAX / PLACES.length - 1)) * PLACES.length;
    const seed = Math.max(PLACES.length, base) + kind;
    // a plain field, never the golden tree, for the very first look
    if (!isErdtree(seed)) return seed;
  }
}

/** a fresh seed for the place after this one */
export function nextSeed(seed: number) {
  const kind = (seed + 1) % PLACES.length;
  const base = Math.floor(Math.random() * (SEED_MAX / PLACES.length - 1)) * PLACES.length;
  return Math.max(PLACES.length, base) + kind;
}

/** a fresh seed for another place of the same kind */
export function sameKindSeed(seed: number) {
  const kind = seed % PLACES.length;
  let next = seed;
  while (next === seed) next = Math.max(PLACES.length, Math.floor(Math.random() * (SEED_MAX / PLACES.length - 1)) * PLACES.length) + kind;
  return next;
}
