import { PrivateImage } from "../Upload/PrivateImage";
import { blobViewUrl } from "../../lib/blob";

export interface ImagePreviewProps {
  /** A blob URL, a stored key, or nothing. Private ones are proxied for you. */
  src?: string | null;
  /** Used for the initials when there is no image, and for the alt text. */
  name?: string;
  size?: number;
  /** Square with a small radius, or a circle. */
  shape?: "square" | "circle";
  className?: string;
}

/**
 * An image, with somewhere to stand before and instead of itself.
 *
 * This is `PrivateImage` with the resolver already chosen. The two were
 * separate components with the same hundred lines in each — the loading
 * shimmer, the initials fallback, the hold-until-decoded — which is one
 * component too many: a fix to the fallback had to be made twice or it was
 * made once and they drifted.
 *
 * The difference that justified two of them is only how the picture is
 * addressed: a caller with a URL already in hand uses this; a caller holding a
 * stored id and its own way of resolving one uses `PrivateImage` directly.
 * That is a default argument, not a second component.
 */
export function ImagePreview({ src, name, size, shape, className }: ImagePreviewProps) {
  return (
    <PrivateImage
      fileId={src}
      resolveUrl={blobViewUrl}
      name={name}
      size={size}
      shape={shape}
      className={className}
    />
  );
}
