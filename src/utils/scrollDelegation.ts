import React from "react";

/**
 * Enhanced scroll delegation utility for smooth bidirectional scroll transfer
 * between scrollable containers and the main page
 */

const SCROLL_THRESHOLD = 5; // pixels from edge to start delegation
const SMOOTH_SCROLL_FACTOR = 0.8; // Factor to smooth scroll transitions

export const useScrollDelegation = (containerRef: React.RefObject<HTMLElement>) => {
  const lastScrollTime = React.useRef(0);
  
  const handleWheel = (e: WheelEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const now = Date.now();
    // Throttle scroll events for better performance
    if (now - lastScrollTime.current < 16) return; // ~60fps
    lastScrollTime.current = now;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollDelta = e.deltaY;
    const isScrollingDown = scrollDelta > 0;
    const isScrollingUp = scrollDelta < 0;

    // Enhanced edge detection with thresholds
    const isNearTop = scrollTop <= SCROLL_THRESHOLD;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - SCROLL_THRESHOLD;
    
    // Handle upward delegation at top
    if (isNearTop && isScrollingUp) {
      e.preventDefault();
      
      // Smooth scroll with momentum preservation
      const smoothedDelta = scrollDelta * SMOOTH_SCROLL_FACTOR;
      window.scrollBy({
        top: smoothedDelta,
        behavior: 'instant' // Use instant for smoother continuous scrolling
      });
      return;
    }
    
    // Handle downward delegation at bottom
    if (isNearBottom && isScrollingDown) {
      e.preventDefault();
      
      // Smooth scroll with momentum preservation
      const smoothedDelta = scrollDelta * SMOOTH_SCROLL_FACTOR;
      window.scrollBy({
        top: smoothedDelta,
        behavior: 'instant' // Use instant for smoother continuous scrolling
      });
      return;
    }
  };

  return { handleWheel };
};

/**
 * Hook version for React components - DISABLED
 * This hook is currently disabled to prevent interference with independent scroll bars
 */
export const useScrollDelegationHook = (containerRef: React.RefObject<HTMLElement>) => {
  // No-op: Scroll delegation is disabled
  // Hook calls remain in components to avoid breaking changes
  return;
};