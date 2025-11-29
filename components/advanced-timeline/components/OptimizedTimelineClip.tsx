import React, { memo, useMemo, useCallback } from 'react';
import { DIMENSIONS, ITEM_COLORS, PLAYHEAD } from '../constants';
import { getClipWidth, formatTime } from '../utils';

/**
 * OptimizedTimelineClip Component
 * 
 * A highly optimized timeline clip component using:
 * - React.memo for shallow comparison (prevents re-render if props unchanged)
 * - useMemo for expensive calculations
 * - useCallback for stable event handlers
 * - CSS transforms instead of left/width for GPU acceleration
 */

export interface TimelineClipData {
  id: string;
  title?: string;
  transcript?: string;
  improvedTranscript?: string;
  startTime: number;
  endTime: number;
  type?: 'video' | 'audio' | 'text' | 'caption' | 'image' | 'sticker' | 'effect';
  color?: string;
}

interface OptimizedTimelineClipProps {
  clip: TimelineClipData;
  isActive: boolean;
  isEditing: boolean;
  zoomScale: number;
  onSelect: (clipId: string) => void;
  onMoveLeft?: (clipIndex: number) => void;
  onMoveRight?: (clipIndex: number) => void;
  onDelete?: (clipId: string) => void;
  clipIndex: number;
}

// Memoized inner content component
const ClipContent = memo(({ 
  clip, 
  isActive,
}: { 
  clip: TimelineClipData; 
  isActive: boolean;
}) => {
  const displayText = clip.transcript || clip.title || 'Clip';
  
  return (
    <div className="absolute inset-0 p-1.5 flex flex-col justify-between overflow-hidden">
      <div className="flex items-start justify-between gap-1">
        <span className="text-[9px] font-medium text-white/90 line-clamp-2 leading-tight flex-1">
          {displayText}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-mono text-white/60">
          {formatTime(clip.startTime)}
        </span>
        <span className="text-[8px] font-mono text-white/60">
          {formatTime(clip.endTime)}
        </span>
      </div>
    </div>
  );
});

ClipContent.displayName = 'ClipContent';

// Memoized clip actions component
const ClipActions = memo(({
  clipIndex,
  clipId,
  onMoveLeft,
  onMoveRight,
  onDelete,
}: {
  clipIndex: number;
  clipId: string;
  onMoveLeft?: (index: number) => void;
  onMoveRight?: (index: number) => void;
  onDelete?: (id: string) => void;
}) => {
  const handleMoveLeft = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onMoveLeft?.(clipIndex);
  }, [clipIndex, onMoveLeft]);

  const handleMoveRight = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onMoveRight?.(clipIndex);
  }, [clipIndex, onMoveRight]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(clipId);
  }, [clipId, onDelete]);

  return (
    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      {onMoveLeft && (
        <button
          onClick={handleMoveLeft}
          className="w-4 h-4 rounded bg-black/30 flex items-center justify-center hover:bg-black/50 text-white/70"
          aria-label="Move left"
        >
          <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8">
            <path d="M5 1L2 4l3 3V1z" />
          </svg>
        </button>
      )}
      {onMoveRight && (
        <button
          onClick={handleMoveRight}
          className="w-4 h-4 rounded bg-black/30 flex items-center justify-center hover:bg-black/50 text-white/70"
          aria-label="Move right"
        >
          <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8">
            <path d="M3 1v6l3-3-3-3z" />
          </svg>
        </button>
      )}
      {onDelete && (
        <button
          onClick={handleDelete}
          className="w-4 h-4 rounded bg-red-500/30 flex items-center justify-center hover:bg-red-500/50 text-white/70"
          aria-label="Delete"
        >
          <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8">
            <path d="M1 2h6v5a1 1 0 01-1 1H2a1 1 0 01-1-1V2zm1.5 1v3m2-3v3M2.5 1V0h3v1" />
          </svg>
        </button>
      )}
    </div>
  );
});

ClipActions.displayName = 'ClipActions';

// Main optimized clip component
const OptimizedTimelineClip: React.FC<OptimizedTimelineClipProps> = ({
  clip,
  isActive,
  isEditing,
  zoomScale,
  onSelect,
  onMoveLeft,
  onMoveRight,
  onDelete,
  clipIndex,
}) => {
  // Memoize width calculation
  const clipWidth = useMemo(() => {
    return getClipWidth(clip.startTime, clip.endTime, zoomScale);
  }, [clip.startTime, clip.endTime, zoomScale]);

  // Memoize style object to prevent recreation
  const clipStyle = useMemo(() => {
    const colors = ITEM_COLORS[clip.type || 'default'];
    return {
      width: `${clipWidth}px`,
      background: clip.color || colors.gradient,
      // Use transform for GPU acceleration instead of left
      willChange: 'transform' as const,
    };
  }, [clipWidth, clip.type, clip.color]);

  // Stable click handler
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(clip.id);
  }, [clip.id, onSelect]);

  // Memoize class names
  const className = useMemo(() => {
    const baseClasses = 'group relative h-10 rounded-md cursor-pointer overflow-hidden transition-all';
    const activeClasses = isActive 
      ? 'ring-2 ring-orange-500 ring-offset-1 ring-offset-[#1a1a1f] z-10' 
      : 'hover:brightness-110';
    return `${baseClasses} ${activeClasses}`;
  }, [isActive]);

  return (
    <div
      data-clip="true"
      data-clip-id={clip.id}
      className={className}
      style={clipStyle}
      onClick={handleClick}
    >
      <ClipContent clip={clip} isActive={isActive} />
      
      {!isEditing && (
        <ClipActions
          clipIndex={clipIndex}
          clipId={clip.id}
          onMoveLeft={onMoveLeft}
          onMoveRight={onMoveRight}
          onDelete={onDelete}
        />
      )}

      {/* Edge handles */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20 rounded-l-md" />
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20 rounded-r-md" />
    </div>
  );
};

// Export with React.memo for shallow prop comparison
export default memo(OptimizedTimelineClip, (prevProps, nextProps) => {
  // Custom comparison for better performance
  // Only re-render if these specific props change
  return (
    prevProps.clip.id === nextProps.clip.id &&
    prevProps.clip.startTime === nextProps.clip.startTime &&
    prevProps.clip.endTime === nextProps.clip.endTime &&
    prevProps.clip.transcript === nextProps.clip.transcript &&
    prevProps.clip.title === nextProps.clip.title &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.zoomScale === nextProps.zoomScale &&
    prevProps.clipIndex === nextProps.clipIndex
  );
});

