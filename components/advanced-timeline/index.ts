/**
 * Advanced Timeline Module
 * Export all timeline components, hooks, stores, and utilities
 */

// Main Timeline Component
export { default as Timeline } from './Timeline';
export type { TimelineClip } from './Timeline';

// Stores
export { 
  useTimelineStore, 
  usePlaybackStore, 
  useZoomStore,
  ZOOM_CONSTRAINTS,
} from './stores';

// Hooks
export {
  useTimelineZoom,
  useVideoPlayer,
  useThumbnailProcessor,
  clearThumbnailCache,
  useWaveformProcessor,
  clearWaveformCache,
  useTimelineInteractions,
  useKeyboardShortcuts,
  useTimelineScrollSync,
} from './hooks';

// Components
export { default as OptimizedTimelineClip } from './components/OptimizedTimelineClip';

// Utilities
export * from './utils';

// Constants
export * from './constants';

