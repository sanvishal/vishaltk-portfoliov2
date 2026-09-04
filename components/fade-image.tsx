"use client";

import { useState } from "react";

/** plain img that eases in once it has pixels, so gifs don't pop into place */
export function FadeImage({
  src,
  alt,
  className,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={[
        "transition-[opacity,transform,filter] duration-700 ease-out-strong",
        loaded ? "scale-100 opacity-100 blur-0" : "scale-[0.99] opacity-0 blur-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}
