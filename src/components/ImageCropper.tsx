import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { t } from "../i18n/en";
import type { ProfileImageKind } from "../types";
import { CloseIcon } from "./Icons";

const SHAPES: Record<ProfileImageKind, { aspect: number; output: { width: number; height: number }; round: boolean }> = {
  avatar: { aspect: 1, output: { width: 512, height: 512 }, round: true },
  banner: { aspect: 3, output: { width: 1500, height: 500 }, round: false },
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

interface ImageCropperProps {
  file: File;
  kind: ProfileImageKind;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}

/** Pick the part of a photo to keep: drag to move, slider or wheel to zoom. */
export default function ImageCropper({ file, kind, onCancel, onDone }: ImageCropperProps) {
  const shape = SHAPES[kind];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const zoomId = useId();

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    const reader = new FileReader();
    reader.onload = () => {
      const element = new Image();
      element.onload = () => active && setImage(element);
      element.onerror = () => active && setFailed(true);
      element.src = String(reader.result);
    };
    reader.onerror = () => active && setFailed(true);
    reader.readAsDataURL(file);
    return () => {
      active = false;
      reader.abort();
    };
  }, [file]);

  useEffect(() => {
    const measure = () => {
      const width = frameRef.current?.clientWidth ?? 0;
      setFrame({ width, height: width / shape.aspect });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [shape.aspect]);

  // Scale that makes the photo cover the frame, before the zoom slider
  const baseScale =
    image && frame.width
      ? Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight)
      : 1;
  const scale = baseScale * zoom;

  const clamp = useCallback(
    (next: { x: number; y: number }, atScale: number) => {
      if (!image) return { x: 0, y: 0 };
      const maxX = Math.max(0, (image.naturalWidth * atScale - frame.width) / 2);
      const maxY = Math.max(0, (image.naturalHeight * atScale - frame.height) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [image, frame.width, frame.height],
  );

  useEffect(() => {
    setOffset((current) => clamp(current, scale));
  }, [clamp, scale]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    setOffset(
      clamp(
        { x: start.offsetX + (event.clientX - start.x), y: start.offsetY + (event.clientY - start.y) },
        scale,
      ),
    );
  };

  const endDrag = () => {
    dragStart.current = null;
  };

  const save = () => {
    if (!image) return;
    const canvas = document.createElement("canvas");
    canvas.width = shape.output.width;
    canvas.height = shape.output.height;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Map the visible frame back onto the source image
    const sourceWidth = frame.width / scale;
    const sourceHeight = frame.height / scale;
    const centerX = image.naturalWidth / 2 - offset.x / scale;
    const centerY = image.naturalHeight / 2 - offset.y / scale;

    context.drawImage(
      image,
      centerX - sourceWidth / 2,
      centerY - sourceHeight / 2,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    onDone(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      aria-label={t.cropper.title[kind]}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-ink-900/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex h-full items-end justify-center sm:items-center">
        <div className="bg-surface border-line w-full max-w-lg rounded-t-3xl border p-5 shadow-2xl [animation:sheet-up_320ms_var(--ease-out-soft)_both] sm:rounded-2xl sm:[animation:pop_220ms_var(--ease-spring)_both]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-ink-900 text-lg font-semibold">{t.cropper.title[kind]}</h2>
            <button type="button" onClick={onCancel} aria-label={t.common.close} className="icon-btn">
              <CloseIcon />
            </button>
          </div>

          {failed ? (
            <p role="alert" className="bg-danger-bg text-danger-fg rounded-xl px-4 py-3 text-sm font-medium">
              {t.settings.avatarError}
            </p>
          ) : (
            <>
              <div
                ref={frameRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onWheel={(event) =>
                  setZoom((current) =>
                    Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current - Math.sign(event.deltaY) * 0.15)),
                  )
                }
                style={{ height: frame.height || undefined }}
                className={`bg-surface-hover relative w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing ${
                  shape.round ? "mx-auto max-w-72 rounded-full" : "rounded-xl"
                }`}
              >
                {image && (
                  <img
                    src={image.src}
                    alt=""
                    draggable={false}
                    style={{
                      width: image.naturalWidth * scale,
                      height: image.naturalHeight * scale,
                      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                    }}
                    className="pointer-events-none absolute top-1/2 left-1/2 max-w-none select-none"
                  />
                )}
              </div>

              <label htmlFor={zoomId} className="field-label mt-4">
                {t.cropper.zoom}
              </label>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="text-ink-500 text-xs">
                  1x
                </span>
                <input
                  id={zoomId}
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="accent-brand-600 h-11 flex-1 cursor-pointer"
                />
                <span aria-hidden="true" className="text-ink-500 text-xs">
                  {MAX_ZOOM}x
                </span>
              </div>
              <p className="field-hint">{t.cropper.hint}</p>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={onCancel} className="btn-ghost">
                  {t.common.cancel}
                </button>
                <button type="button" onClick={save} disabled={!image} className="btn-primary sm:min-w-32">
                  {t.cropper.apply}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
