import { useEffect, useRef, useCallback } from 'react';

/**
 * useTimelineScrollSync Hook
 * 
 * Synchronizes scroll position between timeline components.
 * Performance optimizations:
 * - Passive event listeners
 * - Debounced scroll handling
 * - RAF-based updates
 */

interface ScrollSyncOptions {
  containerSelector?: string;
  headerSelector?: string;
  rulerSelector?: string;
}

export const useTimelineScrollSync = (options: ScrollSyncOptions = {}) => {
  const {
    containerSelector = '.timeline-content',
    headerSelector = '.timeline-header-scroll',
    rulerSelector = '.timeline-ruler-scroll',
  } = options;

  const isSyncingRef = useRef(false);
  const rafIdRef = useRef<number>();

  const syncScroll = useCallback((sourceElement: Element, scrollLeft: number) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    // Cancel pending RAF
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      const header = document.querySelector(headerSelector);
      const ruler = document.querySelector(rulerSelector);
      const container = document.querySelector(containerSelector);

      if (header && header !== sourceElement) {
        header.scrollLeft = scrollLeft;
      }
      if (ruler && ruler !== sourceElement) {
        ruler.scrollLeft = scrollLeft;
      }
      if (container && container !== sourceElement) {
        container.scrollLeft = scrollLeft;
      }

      isSyncingRef.current = false;
    });
  }, [containerSelector, headerSelector, rulerSelector]);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as Element;
      syncScroll(target, target.scrollLeft);
    };

    const container = document.querySelector(containerSelector);
    const header = document.querySelector(headerSelector);
    const ruler = document.querySelector(rulerSelector);

    // Use passive listeners for better scroll performance
    const options = { passive: true };

    if (container) {
      container.addEventListener('scroll', handleScroll, options);
    }
    if (header) {
      header.addEventListener('scroll', handleScroll, options);
    }
    if (ruler) {
      ruler.addEventListener('scroll', handleScroll, options);
    }

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
      if (header) {
        header.removeEventListener('scroll', handleScroll);
      }
      if (ruler) {
        ruler.removeEventListener('scroll', handleScroll);
      }
    };
  }, [containerSelector, headerSelector, rulerSelector, syncScroll]);

  return {
    syncScroll,
  };
};

