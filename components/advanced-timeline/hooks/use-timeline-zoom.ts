import { useCallback, useRef } from 'react';
import { useZoomStore, ZOOM_CONSTRAINTS } from '../stores';

/**
 * useTimelineZoom Hook
 * 
 * Manages zoom and scroll behavior for timeline components.
 * Handles both programmatic and wheel-based zooming while maintaining
 * the zoom point relative to cursor position.
 * 
 * Performance optimizations:
 * - Uses Zustand for atomic state updates
 * - Memoized callbacks prevent unnecessary re-renders
 * - Direct DOM manipulation for scroll (no React re-render)
 */
export const useTimelineZoom = (timelineRef: React.RefObject<HTMLDivElement | null>) => {
  const { 
    zoomScale, 
    scrollPosition, 
    setZoomScale, 
    setScrollPosition,
    calculateNewZoom 
  } = useZoomStore();
  
  // Track last zoom time to prevent rapid-fire updates
  const lastZoomTimeRef = useRef(0);
  const ZOOM_THROTTLE_MS = 16; // ~60fps

  const handleZoom = useCallback(
    (delta: number, clientX: number) => {
      // Throttle zoom operations
      const now = performance.now();
      if (now - lastZoomTimeRef.current < ZOOM_THROTTLE_MS) return;
      lastZoomTimeRef.current = now;

      const scrollContainer = timelineRef?.current?.parentElement;
      if (!scrollContainer) return;

      const newZoom = calculateNewZoom(delta);
      if (newZoom === zoomScale) return;

      // Calculate new scroll position to keep zoom centered on cursor
      const rect = scrollContainer.getBoundingClientRect();
      const relativeX = clientX - rect.left + scrollContainer.scrollLeft;
      const zoomFactor = newZoom / zoomScale;
      const newScroll = relativeX * zoomFactor - (clientX - rect.left);

      // Apply scroll directly to DOM (avoid React re-render)
      scrollContainer.scrollLeft = newScroll;

      // Update store state
      setZoomScale(newZoom);
      setScrollPosition(newScroll);
    },
    [timelineRef, zoomScale, calculateNewZoom, setZoomScale, setScrollPosition]
  );

  const handleWheelZoom = useCallback(
    (event: WheelEvent) => {
      // Only zoom when Ctrl/Meta key is pressed
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const delta = -Math.sign(event.deltaY) * ZOOM_CONSTRAINTS.wheelStep;
        handleZoom(delta, event.clientX);
      }
    },
    [handleZoom]
  );

  // Programmatic zoom in/out
  const zoomIn = useCallback(() => {
    const scrollContainer = timelineRef?.current?.parentElement;
    if (!scrollContainer) return;
    const rect = scrollContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    handleZoom(ZOOM_CONSTRAINTS.step, centerX);
  }, [timelineRef, handleZoom]);

  const zoomOut = useCallback(() => {
    const scrollContainer = timelineRef?.current?.parentElement;
    if (!scrollContainer) return;
    const rect = scrollContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    handleZoom(-ZOOM_CONSTRAINTS.step, centerX);
  }, [timelineRef, handleZoom]);

  const resetZoom = useCallback(() => {
    setZoomScale(ZOOM_CONSTRAINTS.default);
    setScrollPosition(0);
    const scrollContainer = timelineRef?.current?.parentElement;
    if (scrollContainer) {
      scrollContainer.scrollLeft = 0;
    }
  }, [timelineRef, setZoomScale, setScrollPosition]);

  return {
    zoomScale,
    scrollPosition,
    setZoomScale,
    setScrollPosition,
    handleZoom,
    handleWheelZoom,
    zoomIn,
    zoomOut,
    resetZoom,
  };
};

