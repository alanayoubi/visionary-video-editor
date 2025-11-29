import { useState, useCallback, useRef } from 'react';
import { useTimelineStore } from '../stores';

/**
 * useTimelineInteractions Hook
 * 
 * Manages mouse interactions for timeline components.
 * Performance optimizations:
 * - Throttled mouse move updates
 * - Direct Zustand state updates (no parent re-renders)
 * - Ref-based tracking for non-reactive state
 */

interface TimelineInteractionsReturn {
  ghostMarkerPosition: number | null;
  isDragging: boolean;
  handleMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseLeave: () => void;
  handleMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseUp: () => void;
}

export const useTimelineInteractions = (
  timelineRef: React.RefObject<HTMLDivElement | null>,
  totalDuration: number = 60,
  zoomScale: number = 1
): TimelineInteractionsReturn => {
  const { 
    ghostMarkerPosition, 
    isDragging,
    setGhostMarkerPosition, 
    setIsDragging 
  } = useTimelineStore();
  
  // Throttle refs
  const lastMoveTimeRef = useRef(0);
  const THROTTLE_MS = 16; // ~60fps

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Throttle updates
    const now = performance.now();
    if (now - lastMoveTimeRef.current < THROTTLE_MS) return;
    lastMoveTimeRef.current = now;

    if (!timelineRef?.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft || 0;
    const x = e.clientX - rect.left + scrollLeft;
    const timelineWidth = rect.width * zoomScale;
    const time = (x / timelineWidth) * totalDuration;

    setGhostMarkerPosition(Math.max(0, Math.min(time, totalDuration)));
  }, [timelineRef, totalDuration, zoomScale, setGhostMarkerPosition]);

  const handleMouseLeave = useCallback(() => {
    setGhostMarkerPosition(null);
  }, [setGhostMarkerPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only start drag on left click
    if (e.button !== 0) return;
    setIsDragging(true);
  }, [setIsDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, [setIsDragging]);

  return {
    ghostMarkerPosition,
    isDragging,
    handleMouseMove,
    handleMouseLeave,
    handleMouseDown,
    handleMouseUp,
  };
};

