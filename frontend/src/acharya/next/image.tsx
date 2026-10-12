import type { CSSProperties, ImgHTMLAttributes } from "react";

/** `next/image` for the Vite build: a plain `<img>`; `fill` covers the parent. */
type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  fill?: boolean;
  unoptimized?: boolean;
  priority?: boolean;
  quality?: number;
  placeholder?: string;
};

export default function Image({ fill, unoptimized: _u, priority, quality: _q, placeholder: _p, style, ...rest }: ImageProps) {
  const fillStyle: CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
    : undefined;
  return <img loading={priority ? "eager" : "lazy"} decoding="async" style={{ ...fillStyle, ...style }} {...rest} />;
}
