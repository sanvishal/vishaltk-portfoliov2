/**
 * on a phone there's no pointer to follow, so the places follow how the phone is held instead.
 * `tilt` is that, in the same -1..1 terms as the pointer: x for leaning it left and right, y for
 * tipping it toward and away from you, measured from however it was being held when we started
 * and slowly re-centring as that changes. it stays inactive on anything with a mouse, and
 * wherever the phone doesn't share its orientation without being asked.
 */
export const tilt = { x: 0, y: 0, active: false };

let started = false;

export function startTilt() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!matchMedia("(pointer: coarse)").matches || !("DeviceOrientationEvent" in window)) return;

  let base: number | null = null;
  const clamp = (v: number) => Math.max(-1.5, Math.min(1.5, v));
  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.gamma === null || e.beta === null) return;
    // turned on its side, the phone's axes swap
    const angle = screen.orientation?.angle ?? 0;
    let lean = e.gamma;
    let tip = e.beta;
    if (angle === 90) [lean, tip] = [e.beta, -e.gamma];
    else if (angle === 270 || angle === -90) [lean, tip] = [-e.beta, e.gamma];
    base ??= tip;
    // follow, very slowly, however the phone settles in the hand
    base += (tip - base) * 0.004;
    tilt.x = clamp(lean / 22);
    tilt.y = clamp((tip - base) / 18);
    tilt.active = true;
  };
  // never asks for permission: where the browser already hands over the readings (android, or
  // ios once allowed) tilt takes over as they arrive; anywhere else nothing comes, and the
  // places carry on following touch as before
  window.addEventListener("deviceorientation", onOrient);
}
