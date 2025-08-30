import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  text: string;
  className?: string;      // apply typography here
  speedPxPerSec?: number;  // default 60
  gapPx?: number;          // default 24
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
  const [active, setActive] = useState(false); // hover/focus
  const [distance, setDistance] = useState(0);

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      const inner = measureRef.current;
      if (!wrap || !inner) return;

      // Force the measure span to its natural width
      const isOverflow = inner.scrollWidth > wrap.clientWidth + 1;
      setOverflowing(isOverflow);
      setDistance(inner.scrollWidth);
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
    const sec = speedPxPerSec > 0 ? px / speedPxPerSec : 6;
    return Math.min(20, Math.max(4, sec)); // clamp 4–20s
  }, [distance, gapPx, speedPxPerSec]);

  const showMarquee = active && overflowing && !prefersReduced;

  return (
    <div
      ref={wrapRef}
      className={`relative block w-full overflow-hidden ${className || ""}`}
      aria-label={text}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      {/* Static, truncated text when not showing marquee */}
      <span
        ref={measureRef}
        className={`block whitespace-nowrap overflow-hidden text-ellipsis ${
          showMarquee ? "invisible" : "visible"
        }`}
      >
        {text}
      </span>

      {/* Marquee only when hovered AND overflowing; clipped by wrapper */}
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