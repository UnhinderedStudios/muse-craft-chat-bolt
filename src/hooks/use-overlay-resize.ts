import { useState, useCallback, useEffect } from 'react';

interface UseOverlayResizeOptions {
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
}

export const useOverlayResize = (options: UseOverlayResizeOptions = {}) => {
  const {
    defaultHeight = 400,
    minHeight = 200,
    maxHeight = window.innerHeight * 0.8
  } = options;

  const [overlayHeight, setOverlayHeight] = useState(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = overlayHeight;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
      setOverlayHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [overlayHeight, minHeight, maxHeight]);

  const resetHeight = useCallback(() => {
    setOverlayHeight(defaultHeight);
  }, [defaultHeight]);

  // Update max height on window resize
  useEffect(() => {
    const updateMaxHeight = () => {
      const newMaxHeight = window.innerHeight * 0.8;
      if (overlayHeight > newMaxHeight) {
        setOverlayHeight(newMaxHeight);
      }
    };

    window.addEventListener('resize', updateMaxHeight);
    return () => window.removeEventListener('resize', updateMaxHeight);
  }, [overlayHeight]);

  return {
    overlayHeight,
    isResizing,
    handleMouseDown,
    resetHeight
  };
};