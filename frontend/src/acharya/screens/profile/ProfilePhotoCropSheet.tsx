"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { useStrings } from "@/acharya/lib/i18n/useLang";

interface Props {
  open: boolean;
  /** Object URL or data URL of the picked image. */
  sourceUrl: string | null;
  onCancel: () => void;
  /** Called with a JPEG File cropped to a square. */
  onConfirm: (file: File) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

/**
 * Interactive square crop + rotate for profile avatars (no extra deps).
 * Drag to pan, pinch/wheel/+− to zoom. Crop (beside Rotate) exports the frame.
 */
export function ProfilePhotoCropSheet({ open, sourceUrl, onCancel, onConfirm }: Props) {
  const s = useStrings();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [stageSize, setStageSize] = useState(280);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);

  const resetView = useCallback(() => {
    setRotation(0);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setBusy(false);
    setError("");
  }, []);

  useEffect(() => {
    if (!open) resetView();
  }, [open, sourceUrl, resetView]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !open) return;
    const measure = () => setStageSize(el.clientWidth || 280);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [open, sourceUrl]);

  /** Cover scale so the image fills the square at scale=1 (unrotated). */
  function coverScale(turns: number) {
    if (!nat.w || !stageSize) return 1;
    const swap = turns === 90 || turns === 270;
    const w = swap ? nat.h : nat.w;
    const h = swap ? nat.w : nat.h;
    return Math.max(stageSize / w, stageSize / h);
  }

  function clampOffset(next: { x: number; y: number }, nextScale: number, turns: number) {
    if (!nat.w || !stageSize) return next;
    const cover = coverScale(turns);
    const swap = turns === 90 || turns === 270;
    const w = (swap ? nat.h : nat.w) * cover * nextScale;
    const h = (swap ? nat.w : nat.h) * cover * nextScale;
    const maxX = Math.max(0, (w - stageSize) / 2);
    const maxY = Math.max(0, (h - stageSize) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function setScaleClamped(nextScale: number) {
    const turns = ((rotation % 360) + 360) % 360;
    const s2 = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    setScale(s2);
    setOffset((o) => clampOffset(o, s2, turns));
  }

  function onImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    setNat({ w: img.naturalWidth, h: img.naturalHeight });
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const turns = ((rotation % 360) + 360) % 360;
    setOffset(
      clampOffset(
        {
          x: drag.originX + (e.clientX - drag.startX),
          y: drag.originY + (e.clientY - drag.startY),
        },
        scale,
        turns,
      ),
    );
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchRef.current = { startDist: dist, startScale: scale };
      dragRef.current = null;
    }
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = dist / Math.max(1, pinchRef.current.startDist);
      setScaleClamped(pinchRef.current.startScale * ratio);
    }
  }

  function onTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length < 2) pinchRef.current = null;
  }

  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    e.preventDefault();
    setScaleClamped(scale + (e.deltaY > 0 ? -0.08 : 0.08));
  }

  async function exportCropped() {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !stageSize) {
      setError(s.couldNotUploadPhoto);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      const turns = ((rotation % 360) + 360) % 360;
      const cover = coverScale(turns);
      const displayScale = cover * scale;
      const outSize = 1024;

      const canvas = document.createElement("canvas");
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, outSize, outSize);

      // Match CSS `translate(ox,oy) rotate(r)` (rotate first, then pan in screen space).
      const k = outSize / stageSize;
      ctx.translate(outSize / 2, outSize / 2);
      ctx.translate(offset.x * k, offset.y * k);
      ctx.rotate((turns * Math.PI) / 180);
      ctx.scale(displayScale * k, displayScale * k);
      ctx.drawImage(img, -natW / 2, -natH / 2, natW, natH);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Export failed"))),
          "image/jpeg",
          0.92,
        );
      });
      onConfirm(new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : s.couldNotUploadPhoto);
    } finally {
      setBusy(false);
    }
  }

  if (!open || !sourceUrl) return null;

  const turns = ((rotation % 360) + 360) % 360;
  const cover = coverScale(turns);
  const displayW = nat.w ? nat.w * cover * scale : "100%";
  const displayH = nat.h ? nat.h * cover * scale : "100%";

  return (
    <div role="dialog" aria-modal="true" aria-label={s.cropPhotoTitle} style={overlayStyle}>
      <button type="button" aria-label={s.cancel} onClick={onCancel} style={scrimStyle} />
      <div style={sheetStyle} className="slide-up">
        <p style={eyebrowStyle}>{s.cropPhotoTitle}</p>
        <p style={hintStyle}>{s.cropPhotoHint}</p>
        <div
          ref={stageRef}
          style={previewWrapStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onWheel={onWheel}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={sourceUrl}
            alt=""
            draggable={false}
            onLoad={onImgLoad}
            style={{
              ...previewImgStyle,
              width: displayW,
              height: displayH,
              transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
            }}
          />
          <div style={cropFrameStyle} aria-hidden />
        </div>
        <div style={zoomRowStyle}>
          <button
            type="button"
            className="press"
            disabled={busy || scale <= MIN_SCALE}
            aria-label={s.cropZoomOut}
            onClick={() => setScaleClamped(scale - 0.15)}
            style={zoomBtn}
          >
            −
          </button>
          <button
            type="button"
            className="press"
            disabled={busy || scale >= MAX_SCALE}
            aria-label={s.cropZoomIn}
            onClick={() => setScaleClamped(scale + 0.15)}
            style={zoomBtn}
          >
            +
          </button>
        </div>
        {error ? <p style={errorStyle}>{error}</p> : null}
        <div style={toolRowStyle}>
          <button
            type="button"
            className="press"
            disabled={busy}
            onClick={() => {
              const next = rotation + 90;
              setRotation(next);
              const t = ((next % 360) + 360) % 360;
              setOffset((o) => clampOffset(o, scale, t));
            }}
            style={toolBtn}
          >
            {s.cropRotate}
          </button>
          <button
            type="button"
            className="press"
            disabled={busy}
            onClick={() => void exportCropped()}
            style={toolBtnPrimary}
          >
            {busy ? s.uploadingPhoto : s.cropApply}
          </button>
        </div>
        <button type="button" className="press" disabled={busy} onClick={onCancel} style={ghostBtn}>
          {s.cancel}
        </button>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
};

const scrimStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  border: "none",
  background: "rgba(35, 29, 20, 0.55)",
  cursor: "pointer",
};

const sheetStyle: CSSProperties = {
  position: "relative",
  background: "var(--surface)",
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  borderTop: "1px solid var(--rule)",
  padding: "20px 20px max(env(safe-area-inset-bottom), 20px)",
  boxShadow: "var(--shadow-lg)",
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 18,
  color: "var(--ink)",
  margin: "0 0 6px",
};

const hintStyle: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  color: "var(--ink-soft)",
  margin: "0 0 16px",
};

const previewWrapStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 280,
  aspectRatio: "1",
  margin: "0 auto 12px",
  borderRadius: "var(--r-lg)",
  overflow: "hidden",
  background: "var(--surface-sunk)",
  border: "1px solid var(--rule)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  touchAction: "none",
  cursor: "grab",
  userSelect: "none",
};

const previewImgStyle: CSSProperties = {
  position: "absolute",
  objectFit: "fill",
  display: "block",
  pointerEvents: "none",
  maxWidth: "none",
  maxHeight: "none",
  willChange: "transform",
};

const cropFrameStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "var(--r-lg)",
  boxShadow: "inset 0 0 0 2px color-mix(in srgb, var(--green-deep) 55%, transparent)",
  pointerEvents: "none",
};

const zoomRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 10,
  marginBottom: 12,
};

const zoomBtn: CSSProperties = {
  width: 44,
  height: 40,
  borderRadius: "var(--r-md)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  background: "var(--surface-sunk)",
  color: "var(--ink)",
  fontSize: 20,
  fontWeight: 700,
  cursor: "pointer",
  lineHeight: 1,
};

const toolRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  marginBottom: 8,
};

const toolBtn: CSSProperties = {
  flex: 1,
  minHeight: 48,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--rule)",
  borderRadius: "var(--r-lg)",
  background: "transparent",
  color: "var(--ink)",
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const toolBtnPrimary: CSSProperties = {
  ...toolBtn,
  background: "var(--green-deep)",
  borderColor: "var(--green-deep)",
  color: "#f4efdf",
  fontWeight: 700,
};

const ghostBtn: CSSProperties = {
  width: "100%",
  minHeight: 40,
  border: "none",
  background: "transparent",
  color: "var(--ink-soft)",
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  cursor: "pointer",
};

const errorStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--crit)",
  margin: "0 0 10px",
  fontFamily: "var(--font-sans)",
};
