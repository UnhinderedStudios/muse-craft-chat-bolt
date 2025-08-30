import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  text: string;
  className?: string;
  speedPxPerSec?: number; // default 60
  gapPx?: number;         // default 24 (spacing between the two copies)
};

export default function EllipsisMarquee({
  text,
  className,
  speedPxPerSec = 60,
  gapPx = 24,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  const [overflowing, setOverflowing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [distance, setDistance] = useState(0);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      const inner = measureRef.current;
      if (!wrap || !inner) return;
      const isOverflow = inner.scrollWidth > wrap.clientWidth + 1; // 1px tolerance
      setOverflowing(isOverflow);
      if (isOverflow) setDistance(inner.scrollWidth);
    };
    measure();

    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [text]);

  const duration = useMemo(() => {
    const px = distance + gapPx;
    const seconds = speedPxPerSec > 0 ? px / speedPxPerSec : 6;
    return Math.min(20, Math.max(4, seconds)); // clamp 4–20s
  }, [distance, gapPx, speedPxPerSec]);

  const showMarquee = hovered && overflowing && !prefersReduced;

  return (
    <div
      ref={wrapRef}
      className={`relative inline-block max-w-full align-middle ${className || ""}`}
      aria-label={text}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {/* Static ellipsis state */}
      <span
        ref={measureRef}
        className={`block truncate ${showMarquee ? "invisible" : "visible"}`}
      >
        {text}
      </span>

      {/* Marquee appears only when hovered AND overflowing */}
      {showMarquee && (
        <div className="absolute inset-0 flex items-center whitespace-nowrap pointer-events-none">
          <div
            className="marquee-track will-change-transform flex"
            style={
              {
                ["--marquee-distance" as any]: `${distance + gapPx}px`,
                animationDuration: `${duration}s`,
                gap: `${gapPx}px`,
              } as React.CSSProperties
            }
          >
            <span className="shrink-0">{text}</span>
            <span className="shrink-0" aria-hidden="true">
              {text}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}