import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Draws the *real* waveform of the provided audio element (via its src).
 * - Decodes audio with WebAudio and builds peaks.
 * - Falls back to a subtle "template" sticks look if audio/cors isn't ready.
 * - Click/drag to seek; parent supplies onSeek(seconds).
 */
type TrueWaveformProps = {
  audio: HTMLAudioElement | null;
  progress: number; // 0..1
  onSeek?: (seconds: number) => void;
  accent?: string; // e.g. #f92c8f
  height?: number; // px
  className?: string;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function buildPeaks(buffer: AudioBuffer, buckets: number): Float32Array {
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;

  const len = Math.max(ch0.length, ch1.length);
  const blockSize = Math.floor(len / buckets);
  const peaks = new Float32Array(buckets);

  for (let i = 0; i < buckets; i++) {
    const start = i * blockSize;
    const end = i === buckets - 1 ? len : start + blockSize;

    let max = 0;
    for (let j = start; j < end; j++) {
      const val = Math.max(Math.abs(ch0[j] || 0), Math.abs(ch1[j] || 0));
      if (val > max) max = val;
    }
    peaks[i] = max;
  }
  return peaks;
}

export const TrueWaveform: React.FC<TrueWaveformProps> = ({
  audio,
  progress,
  onSeek,
  accent = "#f92c8f",
  height = 56,
  className = "",
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [width, setWidth] = useState<number>(0);

  // Track size via ResizeObserver
  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  // Decode audio whenever the src changes
  useEffect(() => {
    let cancelled = false;
    async function decode() {
      setPeaks(null);
      setAudioDuration(0);
      const src = audio?.src;
      if (!src) return;

      try {
        // Fetch & decode
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const res = await fetch(src, { mode: "cors", cache: "force-cache" });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const ab = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(ab);

        if (cancelled) {
          ctx.close();
          return;
        }

        const buckets = Math.min(Math.max(Math.floor((width || 1200) * 1.2), 300), 6000);
        const p = buildPeaks(buf, buckets);
        setPeaks(p);
        setAudioDuration(buf.duration);
        ctx.close();
      } catch (e) {
        // If fetch/decode fails (likely CORS), we silently keep fallback
        // eslint-disable-next-line no-console
        console.warn("[TrueWaveform] decode failed, using fallback:", e);
      }
    }
    decode();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio?.src]);

  // Redraw on size/peaks/progress change
  useEffect(() => {
    const canvas = canvasRef.current;
    const el = wrapperRef.current;
    if (!canvas || !el) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(10, Math.floor(el.clientWidth));
    const h = Math.max(10, Math.floor(height));

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background is transparent; the dock beneath provides the glass & shadow.
    // Draw either the real waveform or the fallback template.
    if (peaks && peaks.length > 0) {
      const inactive = "rgba(255,255,255,0.22)";
      const active = accent;

      // Build path data
      const midY = h / 2;
      const barW = Math.max(1, w / peaks.length);
      const activeX = clamp01(progress) * w;

      // Inactive waveform
      ctx.fillStyle = inactive;
      drawFilledPath(ctx, peaks, w, h);

      // Active overlay (clip left portion)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, activeX, h);
      ctx.clip();
      ctx.fillStyle = active;
      drawFilledPath(ctx, peaks, w, h);
      ctx.restore();

      // Top sheen (subtle)
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(255,255,255,0.25)");
      grad.addColorStop(0.2, "rgba(255,255,255,0.12)");
      grad.addColorStop(1, "rgba(255,255,255,0.00)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h * 0.55);

      // Center line (very soft)
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, midY - 0.5, w, 1);
    } else {
      // Fallback: soft "template" sticks (keeps your current look when no audio)
      const colInactive = "rgba(255,255,255,0.18)";
      const colActive = accent;
      const gap = 4;     // px between sticks
      const stickW = 2;  // px width of stick
      const midY = h / 2;
      const maxStick = Math.round(h * 0.45);
      const activeX = clamp01(progress) * w;

      for (let x = 0; x < w; x += gap) {
        const noise = 0.4 + 0.6 * Math.sin((x / w) * Math.PI * 3);
        const stickH = Math.max(6, Math.min(maxStick, Math.floor(maxStick * noise)));

        const isActive = x <= activeX;
        const color = isActive ? colActive : colInactive;
        // top
        drawRoundRect(canvas, x, midY - stickH, stickW, stickH, 1, color);
        // bottom
        drawRoundRect(canvas, x, midY, stickW, stickH, 1, color);
      }
    }
  }, [height, width, peaks, progress, accent]);

  // Mouse seek
  const isDragg = useRef(false);
  function timeFromEvent(e: React.MouseEvent<HTMLDivElement>) {
    if (!audio || !audioDuration) return 0;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = clamp01((e.clientX - rect.left) / rect.width);
    return pct * (audio.duration || audioDuration);
  }
  return (
    <div
      ref={wrapperRef}
      className={`relative w-full select-none cursor-pointer rounded-t-2xl overflow-hidden ${className}`}
      style={{ height }}
      onMouseDown={(e) => {
        isDragg.current = true;
        const t = timeFromEvent(e);
        onSeek?.(t);
      }}
      onMouseMove={(e) => {
        if (!isDragg.current) return;
        const t = timeFromEvent(e);
        onSeek?.(t);
      }}
      onMouseUp={() => (isDragg.current = false)}
      onMouseLeave={() => (isDragg.current = false)}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};

function drawFilledPath(
  ctx: CanvasRenderingContext2D,
  peaks: Float32Array,
  w: number,
  h: number
) {
  const midY = h / 2;
  const len = peaks.length;
  const stepX = w / len;
  const amp = (h * 0.9) / 2; // margins top/bottom

  ctx.beginPath();
  // Top edge (left -> right)
  for (let i = 0; i < len; i++) {
    const x = i * stepX;
    const y = midY - Math.max(1, peaks[i] * amp);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  // Bottom edge (right -> left), mirror
  for (let i = len - 1; i >= 0; i--) {
    const x = i * stepX;
    const y = midY + Math.max(1, peaks[i] * amp);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawRoundRect(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string
) {
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

export default TrueWaveform;
