/**
 * Timeline Utilities
 * Helper functions for timeline calculations and conversions
 */

import { DIMENSIONS, ZOOM_CONSTRAINTS } from '../constants';

/**
 * Convert time (seconds) to pixel position
 */
export const timeToPixels = (
  time: number,
  zoomScale: number = 1,
  pixelsPerSecond: number = DIMENSIONS.PIXELS_PER_SECOND
): number => {
  return time * pixelsPerSecond * zoomScale;
};

/**
 * Convert pixel position to time (seconds)
 */
export const pixelsToTime = (
  pixels: number,
  zoomScale: number = 1,
  pixelsPerSecond: number = DIMENSIONS.PIXELS_PER_SECOND
): number => {
  return pixels / (pixelsPerSecond * zoomScale);
};

/**
 * Calculate clip width in pixels
 */
export const getClipWidth = (
  startTime: number,
  endTime: number,
  zoomScale: number = 1,
  minWidth: number = DIMENSIONS.ITEM_MIN_WIDTH
): number => {
  const duration = endTime - startTime;
  return Math.max(timeToPixels(duration, zoomScale), minWidth);
};

/**
 * Calculate clip position (left offset) in pixels
 */
export const getClipLeft = (startTime: number, zoomScale: number = 1): number => {
  return timeToPixels(startTime, zoomScale);
};

/**
 * Format time as MM:SS
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format time as MM:SS.FF (with frames)
 */
export const formatTimeWithFrames = (seconds: number, fps: number = 30): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * fps);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
};

/**
 * Clamp zoom scale to valid range
 */
export const clampZoom = (scale: number): number => {
  return Math.max(ZOOM_CONSTRAINTS.min, Math.min(ZOOM_CONSTRAINTS.max, scale));
};

/**
 * Calculate snap position for timeline items
 */
export const calculateSnapPosition = (
  currentPosition: number,
  snapTargets: number[],
  threshold: number = 0.1 // in seconds
): number => {
  let closestTarget = currentPosition;
  let minDistance = threshold;

  for (const target of snapTargets) {
    const distance = Math.abs(currentPosition - target);
    if (distance < minDistance) {
      minDistance = distance;
      closestTarget = target;
    }
  }

  return closestTarget;
};

/**
 * Check if two time ranges overlap
 */
export const rangesOverlap = (
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean => {
  return start1 < end2 && end1 > start2;
};

/**
 * Get total duration from clips array
 */
export const getTotalDuration = (
  clips: Array<{ startTime: number; endTime: number }>
): number => {
  if (clips.length === 0) return 0;
  return Math.max(...clips.map((c) => c.endTime));
};

/**
 * Debounce function for performance optimization
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
};

/**
 * Throttle function for performance optimization
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          func(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
};

/**
 * Generate unique ID
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

