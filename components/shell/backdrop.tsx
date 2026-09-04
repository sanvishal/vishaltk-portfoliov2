/** the two breathing washes and the grain. all driven by css variables per look. */
export function Backdrop() {
  return (
    <>
      <div aria-hidden className="wash" />
      <div aria-hidden className="wash wash-2" />
      <svg aria-hidden className="grain">
        <filter id="grain-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-noise)" />
      </svg>
    </>
  );
}
