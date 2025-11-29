/**
 * Timeline Constants
 * Centralized configuration for timeline behavior
 */

// Zoom constraints
export const ZOOM_CONSTRAINTS = {
  min: 0.1,
  max: 10,
  step: 0.1,
  default: 1,
  wheelStep: 0.2,
};

// Performance thresholds
export const PERFORMANCE = {
  FRAME_THROTTLE_MS: 16, // ~60fps
  SCROLL_THROTTLE_MS: 16,
  DRAG_THROTTLE_MS: 8, // ~120fps for smoother dragging
  RESIZE_DEBOUNCE_MS: 100,
  CACHE_CLEANUP_INTERVAL_MS: 60000, // 1 minute
  CACHE_MAX_AGE_MS: 600000, // 10 minutes
};

// Timeline dimensions
export const DIMENSIONS = {
  TRACK_HEIGHT: 56,
  TRACK_MIN_HEIGHT: 40,
  TRACK_MAX_HEIGHT: 120,
  ITEM_HEIGHT: 40,
  ITEM_MIN_WIDTH: 60,
  RULER_HEIGHT: 24,
  HEADER_HEIGHT: 40,
  TRACK_HANDLE_WIDTH: 112,
  PIXELS_PER_SECOND: 8,
  GAP_BETWEEN_ITEMS: 4,
};

// Snap thresholds (in pixels)
export const SNAP = {
  THRESHOLD_PX: 8,
  MAGNETIC_THRESHOLD_PX: 16,
};

// Timeline item colors by type
export const ITEM_COLORS = {
  video: {
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    border: '#8b5cf6',
  },
  audio: {
    gradient: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
    border: '#14b8a6',
  },
  text: {
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    border: '#60a5fa',
  },
  caption: {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    border: '#fbbf24',
  },
  image: {
    gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    border: '#f472b6',
  },
  sticker: {
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    border: '#34d399',
  },
  effect: {
    gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    border: '#818cf8',
  },
  default: {
    gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
    border: '#9ca3af',
  },
};

// Playhead styles
export const PLAYHEAD = {
  color: '#f97316', // Orange
  width: 2,
  glowColor: 'rgba(249, 115, 22, 0.5)',
  handleSize: 14,
};

// Timeline ruler intervals
export const RULER = {
  MAJOR_INTERVAL: 10, // seconds
  MINOR_TICKS_PER_MAJOR: 9,
};

