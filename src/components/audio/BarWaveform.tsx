import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type Props = {
  /** Active HTMLAudioElement for the current track */
  audio?: HTMLAudioElement | null;
  /** Current playback time (seconds) */
  currentTime: number;
  /** Called when user seeks by clicking the waveform */
  onSeek?: (time: number) => void;
  /** Accent color for the played portion */
  accent?: string;
  /** Height in px of the waveform band */
  height?: number;
  /** Bar width and gap in CSS px */
  barWidth?: number;
  barGap?: number;
};

/**
 * Renders a clean "bar sticks" waveform that reflects real audio.
 * - Edge-to-edge, no rounded corners, no bevels, no borders.
 * - Played portion tinted with accent; remainder neutral.
 * - Uses WebAudio decode to compute peaks; falls back to a nice placeholder when no audio.
 */
export default function BarWaveform({
  audio,
  currentTime,
  onSeek,
  accent = "#f92c8f",
  height = 56,
  barWidth = 3,
  barGap = 1,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const srcKey = audio?.currentSrc || audio?.src || "";

  // Keep canvas crisp on HiDPI
  const fitCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.height = `${height}px`;
    // Trigger redraw after canvas resize
    draw();
  };

  useLayoutEffect(() => {
    fitCanvas();
    const ro = new ResizeObserver(() => fitCanvas());
    const el = canvasRef.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  // Decode audio & compute peaks when src changes
  useEffect(() => {
    let aborted = false;

    async function run() {
      setPeaks(null);
      setDuration(audio?.duration || 0);
      if (!audio || !srcKey) return;

      try {
        // Skip CORS fetch for known non-CORS hosts
        if (srcKey.includes('soundjay.com')) {
          return; // Leave peaks null for placeholder
        }
        
        // Fetch and decode
        const res = await fetch(srcKey, { mode: "cors", credentials: "omit" });
        const buf = await res.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decoded = await ctx.decodeAudioData(buf);
        if (aborted) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const totalBars = Math.max(60, Math.floor(rect.width / (barWidth + barGap)));
        // Use first channel for peaks; you can optionally merge channels
        const data = decoded.numberOfChannels > 1
          ? mergeToMono(decoded)
          : decoded.getChannelData(0);

        const samplesPerBar = Math.max(1, Math.floor(data.length / totalBars));
        const out = new Float32Array(totalBars);

        for (let i = 0; i < totalBars; i++) {
          const start = i * samplesPerBar;
          const end = Math.min(start + samplesPerBar, data.length);
          let peak = 0;
          for (let j = start; j < end; j++) {
            const v = Math.abs(data[j]);
            if (v > peak) peak = v; // use max for that "stick" look
          }
          out[i] = peak;
        }

        // Normalize
        const max = out.reduce((m, v) => (v > m ? v : m), 0.0001);
        for (let i = 0; i < out.length; i++) out[i] = out[i] / max;

        if (!aborted) {
          setPeaks(out);
          setDuration(decoded.duration || audio.duration || 0);
        }
      } catch {
        // leave peaks null → placeholder will render
      }
    }

    run();
    return () => {
      aborted = true;
    };
  }, [srcKey, audio, barGap, barWidth]);

  // Draw on every relevant change
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peaks, currentTime, height, barWidth, barGap, accent]);

  // Add canvas width to dependencies for redraw on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ro = new ResizeObserver(() => {
      // Only redraw if we have peaks or are in placeholder mode
      if (peaks || !srcKey) {
        draw();
      }
    });
    
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [peaks, srcKey]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const t = Math.max(0, Math.min(duration, pct * duration));
    onSeek?.(t);
  };

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = canvas.width;
    const H = canvas.height;
    const mid = Math.floor(H / 2);

    // Clear — transparent to sit over dark background
    ctx.clearRect(0, 0, W, H);

    // Bars geometry
    const pxBarW = Math.floor(barWidth * dpr);
    const pxGap = Math.floor(barGap * dpr);
    const totalBars = Math.max(1, Math.floor(W / (pxBarW + pxGap)));
    const barMax = Math.floor(H * 0.9); // leave 10% padding
    const progressPct = duration ? currentTime / duration : 0;

    const thePeaks = peaks ?? placeholder(totalBars);

    for (let i = 0; i < totalBars; i++) {
      const x = i * (pxBarW + pxGap);
      const value = thePeaks[i] ?? 0;
      const h = Math.max(Math.floor(value * barMax), Math.floor(4 * dpr)); // min visible height
      const y = Math.floor(mid - h / 2);

      // Decide color based on progress
      const played = i / totalBars <= progressPct;
      ctx.fillStyle = played ? accent : "rgba(255,255,255,0.25)";
      ctx.fillRect(x, y, pxBarW, h);
    }
  }

  return (
    <div className="relative w-full select-none" style={{ height }}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full !rounded-none"
        onClick={handleClick}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={duration || 0}
        aria-valuenow={currentTime || 0}
      />
    </div>
  );
}

function mergeToMono(buf: AudioBuffer): Float32Array {
  const len = buf.length;
  const out = new Float32Array(len);
  const chs = buf.numberOfChannels;
  for (let c = 0; c < chs; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < len; i++) out[i] += data[i] / chs;
  }
  return out;
}

/** Subtle placeholder bars while no audio/peaks ready */
function placeholder(n: number) {
  const arr = new Float32Array(n);
  // repeatable pseudo-random with a gentle wave so it looks like "real-ish" bars
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const base = 0.25 + 0.65 * Math.sin(t * Math.PI); // center swell
    const noise = 0.08 * Math.sin(i * 9.73) + 0.06 * Math.sin(i * 3.31);
    arr[i] = Math.min(1, Math.max(0.1, base + noise));
  }
  return arr;
}
