import React from "react";

/**
 * Utility for implementing scroll delegation - when a scrollable element reaches its bottom,
 * transfer additional scroll motion to the main page scroll for seamless user experience.
 */

export const useScrollDelegation = (containerRef: React.RefObject<HTMLElement>) => {
  const handleWheel = (e: WheelEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = Math.abs(scrollTop + clientHeight - scrollHeight) < 1;
    const isScrollingDown = e.deltaY > 0;

    // If we're at the bottom and trying to scroll down, delegate to main page
    if (isAtBottom && isScrollingDown) {
      e.preventDefault();
      
      // Apply the scroll delta to the main page
      const scrollAmount = e.deltaY;
      window.scrollBy({
        top: scrollAmount,
        behavior: 'auto'
      });
    }
  };

  return { handleWheel };
};

/**
 * Hook version for React components
 */
export const useScrollDelegationHook = (containerRef: React.RefObject<HTMLElement>) => {
  const { handleWheel } = useScrollDelegation(containerRef);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel, containerRef]);
};