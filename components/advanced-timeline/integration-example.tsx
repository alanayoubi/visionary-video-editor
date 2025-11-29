/**
 * Integration Example
 * 
 * This file demonstrates how to integrate the new performance optimizations
 * into your existing App.tsx. Copy the relevant patterns into your code.
 * 
 * DO NOT import this file directly - it's for reference only.
 */

import React, { useRef, useMemo, useCallback, memo } from 'react';

// Import the new stores and hooks
import { 
  useTimelineStore, 
  usePlaybackStore, 
  useZoomStore 
} from './stores';

import {
  useTimelineZoom,
  useVideoPlayer,
  useKeyboardShortcuts,
  useTimelineInteractions,
} from './hooks';

import { DIMENSIONS } from './constants';
import { getClipWidth, formatTime, getTotalDuration } from './utils';
import OptimizedTimelineClip, { TimelineClipData } from './components/OptimizedTimelineClip';

/**
 * PATTERN 1: Replace useState with Zustand stores
 * 
 * BEFORE (causes re-renders on any state change):
 * ```tsx
 * const [isPlaying, setIsPlaying] = useState(false);
 * const [currentSequenceTime, setCurrentSequenceTime] = useState(0);
 * const [clips, setClips] = useState<Clip[]>([]);
 * ```
 * 
 * AFTER (atomic updates, selective re-renders):
 * ```tsx
 * // In your component:
 * const isPlaying = usePlaybackStore(state => state.isPlaying);
 * const setIsPlaying = usePlaybackStore(state => state.setIsPlaying);
 * const currentTime = usePlaybackStore(state => state.currentTime);
 * ```
 */

/**
 * PATTERN 2: Use the optimized video player hook
 */
function ExampleVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Use the optimized video player hook
  const {
    isPlaying,
    currentTime,
    currentFrame,
    duration,
    play,
    pause,
    togglePlayPause,
    seekTo,
    formatTime: formatVideoTime,
  } = useVideoPlayer(videoRef, { fps: 30 });

  // Enable keyboard shortcuts
  useKeyboardShortcuts({
    videoRef,
    seekAmount: 5,
  });

  return (
    <div>
      <video ref={videoRef} src="your-video.mp4" />
      <button onClick={togglePlayPause}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <span>{formatVideoTime(currentTime)}</span>
    </div>
  );
}

/**
 * PATTERN 3: Memoize expensive calculations
 * 
 * BEFORE (recalculated every render):
 * ```tsx
 * const totalDuration = Math.max(...clips.map(c => c.endTime), 60);
 * ```
 * 
 * AFTER (only recalculated when clips change):
 * ```tsx
 * const totalDuration = useMemo(() => {
 *   return clips.length > 0 ? Math.max(...clips.map(c => c.endTime)) : 60;
 * }, [clips]);
 * ```
 */

/**
 * PATTERN 4: Memoize event handlers
 * 
 * BEFORE (new function every render):
 * ```tsx
 * onClick={() => setActiveClipId(clip.id)}
 * ```
 * 
 * AFTER (stable reference):
 * ```tsx
 * const handleClipSelect = useCallback((clipId: string) => {
 *   setActiveClipId(clipId);
 * }, [setActiveClipId]);
 * ```
 */

/**
 * PATTERN 5: Use the optimized timeline clip component
 */
interface OptimizedTimelineTrackProps {
  clips: TimelineClipData[];
  activeClipId: string | null;
  editingClipId: string | null;
  zoomScale: number;
  onClipSelect: (clipId: string) => void;
  onMoveClip: (index: number, direction: 'left' | 'right') => void;
  onDeleteClip: (clipId: string) => void;
}

const OptimizedTimelineTrack = memo(({
  clips,
  activeClipId,
  editingClipId,
  zoomScale,
  onClipSelect,
  onMoveClip,
  onDeleteClip,
}: OptimizedTimelineTrackProps) => {
  // Memoize move handlers
  const handleMoveLeft = useCallback((index: number) => {
    onMoveClip(index, 'left');
  }, [onMoveClip]);

  const handleMoveRight = useCallback((index: number) => {
    onMoveClip(index, 'right');
  }, [onMoveClip]);

  return (
    <div className="h-14 border-b border-zinc-800/30 flex items-center px-2 gap-1 relative bg-[#1a1a1f]">
      {clips.map((clip, index) => (
        <OptimizedTimelineClip
          key={clip.id}
          clip={clip}
          clipIndex={index}
          isActive={activeClipId === clip.id}
          isEditing={editingClipId === clip.id}
          zoomScale={zoomScale}
          onSelect={onClipSelect}
          onMoveLeft={handleMoveLeft}
          onMoveRight={handleMoveRight}
          onDelete={onDeleteClip}
        />
      ))}
    </div>
  );
});

OptimizedTimelineTrack.displayName = 'OptimizedTimelineTrack';

/**
 * PATTERN 6: Use timeline zoom with wheel support
 */
function ExampleTimelineWithZoom() {
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const {
    zoomScale,
    setZoomScale,
    handleWheelZoom,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useTimelineZoom(timelineRef);

  // Attach wheel zoom listener
  React.useEffect(() => {
    const element = timelineRef.current;
    if (!element) return;

    element.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => element.removeEventListener('wheel', handleWheelZoom);
  }, [handleWheelZoom]);

  return (
    <div ref={timelineRef}>
      {/* Timeline content scaled by zoomScale */}
      <div style={{ transform: `scaleX(${zoomScale})`, transformOrigin: 'left' }}>
        {/* Your timeline tracks here */}
      </div>
      <div className="zoom-controls">
        <button onClick={zoomOut}>-</button>
        <span>{Math.round(zoomScale * 100)}%</span>
        <button onClick={zoomIn}>+</button>
      </div>
    </div>
  );
}

/**
 * PATTERN 7: Optimized playhead position updates
 * 
 * Use requestAnimationFrame-based updates instead of setInterval
 * This is already handled in useVideoPlayer hook
 */

/**
 * PATTERN 8: Memoize the ruler intervals
 */
function OptimizedTimeRuler({ totalDuration, zoomScale }: { totalDuration: number; zoomScale: number }) {
  // Memoize the interval markers
  const markers = useMemo(() => {
    const intervals = Math.ceil(totalDuration / 10);
    return Array.from({ length: intervals + 1 }, (_, i) => ({
      time: i * 10,
      label: formatTime(i * 10),
    }));
  }, [totalDuration]);

  return (
    <div className="timeline-ruler">
      {markers.map((marker, i) => (
        <div key={i} className="marker" style={{ left: marker.time * DIMENSIONS.PIXELS_PER_SECOND * zoomScale }}>
          <span>{marker.label}</span>
        </div>
      ))}
    </div>
  );
}

export {
  ExampleVideoPlayer,
  OptimizedTimelineTrack,
  ExampleTimelineWithZoom,
  OptimizedTimeRuler,
};

