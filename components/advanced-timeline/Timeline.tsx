/**
 * Modular Timeline Component - SEQUENCE-BASED COORDINATES
 * 
 * IMPORTANT: This timeline uses SEQUENCE TIME (accumulated clip durations)
 * not raw video time. This means:
 * - First clip always starts at position 0 in the timeline
 * - Clips are positioned based on their order in the sequence
 * - Seeking to 0 always goes to the start of the first clip
 * 
 * Features:
 * - Professional zoom controls (+/- buttons, slider, fit-to-view, reset)
 * - Mouse wheel zoom with Ctrl/Cmd key
 * - 60fps playhead updates
 * - Perfect ruler/playhead/clip synchronization
 */

import React, { memo, useCallback, useRef, useEffect, useMemo } from 'react';
import { useZoomStore, usePlaybackStore, ZOOM_CONSTRAINTS } from './stores';
import { RULER } from './constants';
import { formatTime } from './utils';

// Types
export interface TimelineClip {
  id: string;
  title?: string;
  transcript?: string;
  improvedTranscript?: string;
  startTime: number;  // Raw video start time
  endTime: number;    // Raw video end time
  audioStartTime?: number;
  audioEndTime?: number;
  redundancies?: Array<{ type: string; duration: number }>;
}

// Helper: Get clip duration
const getClipDuration = (clip: TimelineClip): number => {
  return clip.endTime - clip.startTime;
};

// Helper: Calculate sequence position for each clip (accumulated durations)
interface ClipSequenceInfo {
  clip: TimelineClip;
  sequenceStart: number;  // Where this clip starts in sequence time
  sequenceEnd: number;    // Where this clip ends in sequence time
  duration: number;
}

interface TimelineProps {
  clips: TimelineClip[];
  activeClipId: string | null;
  editingClipId: string | null;
  editingText: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  audioRef?: React.RefObject<HTMLAudioElement>;
  masterAudioUrl: string | null;
  onClipSelect: (clipId: string, startTime: number) => void;
  onClipMove: (index: number, direction: 'left' | 'right') => void;
  onClipDelete: (clipId: string) => void;
  onStartEdit: (clip: TimelineClip) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  onFixRedundancy: (clipId: string, issue: any) => void;
  onSeek?: (rawVideoTime: number, clipId: string | null, clipStartTime: number) => void;
}

// Content styles for zoom
const getContentStyles = (zoomScale: number) => ({
  width: `${Math.max(100, 100 * zoomScale)}%`,
  minWidth: '100%',
});

// Zoom controls component
const ZoomControls = memo(function ZoomControls({
  zoomScale,
  onZoomIn,
  onZoomOut,
  onZoomChange,
  onFitToView,
  onResetZoom,
}: {
  zoomScale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomChange: (scale: number) => void;
  onFitToView: () => void;
  onResetZoom: () => void;
}) {
  const zoomPercentage = Math.round(zoomScale * 100);
  
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-900/80 rounded-lg border border-zinc-800/50">
      <button
        onClick={onZoomOut}
        disabled={zoomScale <= ZOOM_CONSTRAINTS.min}
        className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Zoom Out (Ctrl + Scroll Down)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>

      <div className="relative w-24 h-5 flex items-center group">
        <input
          type="range"
          min={ZOOM_CONSTRAINTS.min * 100}
          max={ZOOM_CONSTRAINTS.max * 100}
          step={ZOOM_CONSTRAINTS.step * 100}
          value={zoomPercentage}
          onChange={(e) => onZoomChange(parseInt(e.target.value) / 100)}
          className="w-full h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer 
            [&::-webkit-slider-thumb]:appearance-none 
            [&::-webkit-slider-thumb]:w-3 
            [&::-webkit-slider-thumb]:h-3 
            [&::-webkit-slider-thumb]:rounded-full 
            [&::-webkit-slider-thumb]:bg-indigo-500 
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-125
            [&::-moz-range-thumb]:w-3 
            [&::-moz-range-thumb]:h-3 
            [&::-moz-range-thumb]:rounded-full 
            [&::-moz-range-thumb]:bg-indigo-500 
            [&::-moz-range-thumb]:cursor-pointer"
        />
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-zinc-800 text-[9px] text-zinc-300 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          {zoomPercentage}%
        </div>
      </div>

      <button
        onClick={onZoomIn}
        disabled={zoomScale >= ZOOM_CONSTRAINTS.max}
        className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Zoom In (Ctrl + Scroll Up)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <div className="w-px h-4 bg-zinc-700 mx-1" />

      <button
        onClick={onFitToView}
        className="px-2 h-6 rounded text-[10px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
        title="Fit to View"
      >
        Fit
      </button>

      <button
        onClick={onResetZoom}
        className="px-2 h-6 rounded text-[10px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
        title="Reset to 100%"
      >
        100%
      </button>
    </div>
  );
});

// Memoized Clip Component - uses SEQUENCE-BASED positioning
const TimelineClipItem = memo(function TimelineClipItem({
  clip,
  index,
  isActive,
  sequenceStart,
  sequenceEnd,
  totalSequenceDuration,
  onSelect,
  onMove,
  onDelete,
}: {
  clip: TimelineClip;
  index: number;
  isActive: boolean;
  sequenceStart: number;
  sequenceEnd: number;
  totalSequenceDuration: number;
  onSelect: (id: string, startTime: number) => void;
  onMove: (index: number, direction: 'left' | 'right') => void;
  onDelete: (id: string) => void;
}) {
  const duration = sequenceEnd - sequenceStart;
  // Position based on SEQUENCE time, not raw video time
  const leftPercentage = (sequenceStart / totalSequenceDuration) * 100;
  const widthPercentage = Math.max((duration / totalSequenceDuration) * 100, 0.5);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(clip.id, clip.startTime);
  }, [clip.id, clip.startTime, onSelect]);

  const handleMoveLeft = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onMove(index, 'left');
  }, [index, onMove]);

  const handleMoveRight = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onMove(index, 'right');
  }, [index, onMove]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(clip.id);
  }, [clip.id, onDelete]);

  return (
    <div
      data-clip="true"
      className={`group absolute h-10 rounded-md cursor-pointer overflow-hidden transition-shadow ${
        isActive
          ? 'ring-2 ring-orange-500 ring-offset-1 ring-offset-[#1a1a1f] z-10'
          : 'hover:brightness-110'
      }`}
      style={{
        left: `${leftPercentage}%`,
        width: `${widthPercentage}%`,
        minWidth: '40px',
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
      }}
      onClick={handleClick}
    >
      <div className="absolute inset-0 p-1.5 flex flex-col justify-between overflow-hidden">
        <div className="flex items-start justify-between gap-1">
          <span className="text-[9px] font-medium text-white/90 line-clamp-2 leading-tight flex-1">
            {clip.transcript || clip.title}
          </span>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={handleMoveLeft} className="w-4 h-4 rounded bg-black/30 flex items-center justify-center hover:bg-black/50 text-white/70">
              <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8"><path d="M5 1L2 4l3 3V1z" /></svg>
            </button>
            <button onClick={handleMoveRight} className="w-4 h-4 rounded bg-black/30 flex items-center justify-center hover:bg-black/50 text-white/70">
              <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8"><path d="M3 1v6l3-3-3-3z" /></svg>
            </button>
            <button onClick={handleDelete} className="w-4 h-4 rounded bg-red-500/30 flex items-center justify-center hover:bg-red-500/50 text-white/70">
              <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8"><path d="M1 2h6v5a1 1 0 01-1 1H2a1 1 0 01-1-1V2z" /></svg>
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-mono text-white/60">{formatTime(sequenceStart)}</span>
          <span className="text-[8px] font-mono text-white/60">{formatTime(sequenceEnd)}</span>
        </div>
      </div>
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-300/30 rounded-l-md" />
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-violet-300/30 rounded-r-md" />
    </div>
  );
});

// Memoized Polished Clip Component - uses SEQUENCE-BASED positioning
const PolishedClipItem = memo(function PolishedClipItem({
  clip,
  isActive,
  isEditing,
  editingText,
  sequenceStart,
  sequenceEnd,
  totalSequenceDuration,
  masterAudioUrl,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditTextChange,
}: {
  clip: TimelineClip;
  isActive: boolean;
  isEditing: boolean;
  editingText: string;
  sequenceStart: number;
  sequenceEnd: number;
  totalSequenceDuration: number;
  masterAudioUrl: string | null;
  onSelect: (id: string, startTime: number) => void;
  onStartEdit: (clip: TimelineClip) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
}) {
  const duration = sequenceEnd - sequenceStart;
  const leftPercentage = (sequenceStart / totalSequenceDuration) * 100;
  const widthPercentage = Math.max((duration / totalSequenceDuration) * 100, 0.5);
  const hasPolished = !!clip.improvedTranscript;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(clip.id, clip.startTime);
  }, [clip.id, clip.startTime, onSelect]);

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onStartEdit(clip);
  }, [clip, onStartEdit]);

  return (
    <div
      data-clip="true"
      className={`group absolute h-10 rounded-md cursor-pointer overflow-hidden transition-shadow ${
        isActive
          ? 'ring-2 ring-orange-500 ring-offset-1 ring-offset-[#18181c] z-10'
          : 'hover:brightness-110'
      } ${!hasPolished ? 'opacity-40' : ''}`}
      style={{
        left: `${leftPercentage}%`,
        width: `${widthPercentage}%`,
        minWidth: '40px',
        top: '50%',
        transform: 'translateY(-50%)',
        background: hasPolished
          ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'
          : 'linear-gradient(135deg, #3f3f46 0%, #27272a 100%)',
      }}
      onClick={handleClick}
    >
      <div className="absolute inset-0 p-1.5 flex flex-col justify-between overflow-hidden">
        <div className="flex items-start justify-between gap-1">
          {isEditing ? (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <textarea
                className="w-full h-6 bg-black/30 text-white text-[9px] p-1 rounded border border-teal-400/50 outline-none resize-none"
                value={editingText}
                onChange={(e) => onEditTextChange(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-0.5 mt-0.5">
                <button onClick={(e) => { e.stopPropagation(); onCancelEdit(); }} className="p-0.5 bg-zinc-700 hover:bg-zinc-600 rounded">
                  <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onSaveEdit(); }} className="p-0.5 bg-teal-600 hover:bg-teal-500 rounded text-white">
                  <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="text-[9px] font-medium text-white/90 line-clamp-2 leading-tight flex-1">
                {hasPolished ? (
                  <><span className="mr-0.5">✨</span>{clip.improvedTranscript}</>
                ) : (
                  <span className="text-zinc-400 italic">Not polished</span>
                )}
              </span>
              {hasPolished && (
                <button
                  onClick={handleStartEdit}
                  className="w-4 h-4 rounded bg-black/30 flex items-center justify-center hover:bg-black/50 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                </button>
              )}
            </>
          )}
        </div>
        {!isEditing && (
          <div className="flex items-center justify-between">
            {masterAudioUrl && hasPolished && (
              <div className="flex items-center gap-0.5 text-[8px] text-white/80 bg-black/20 px-1 rounded">
                <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20"><path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" /></svg>
                <span>Sync</span>
              </div>
            )}
            <span className="text-[8px] font-mono text-white/60 ml-auto">{formatTime(duration)}s</span>
          </div>
        )}
      </div>
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-300/30 rounded-l-md" />
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-teal-300/30 rounded-r-md" />
    </div>
  );
});

// Main Timeline Component
const Timeline: React.FC<TimelineProps> = ({
  clips,
  activeClipId,
  editingClipId,
  editingText,
  videoRef,
  audioRef,
  masterAudioUrl,
  onClipSelect,
  onClipMove,
  onClipDelete,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditTextChange,
  onFixRedundancy,
  onSeek,
}) => {
  const { isPlaying } = usePlaybackStore();
  const { 
    zoomScale, 
    setZoomScale, 
    zoomIn, 
    zoomOut, 
    resetZoom,
    calculateNewZoom,
  } = useZoomStore();
  
  // Refs for DOM elements
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rulerContentRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const rulerPlayheadRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const lastZoomTimeRef = useRef(0);

  // Calculate total SEQUENCE duration (sum of clip durations)
  const totalSequenceDuration = useMemo(() => {
    return clips.reduce((acc, clip) => acc + getClipDuration(clip), 0) || 60;
  }, [clips]);

  // Calculate sequence info for each clip (start/end positions in sequence time)
  const clipsWithSequenceInfo = useMemo((): ClipSequenceInfo[] => {
    let accumulatedTime = 0;
    return clips.map(clip => {
      const duration = getClipDuration(clip);
      const info: ClipSequenceInfo = {
        clip,
        sequenceStart: accumulatedTime,
        sequenceEnd: accumulatedTime + duration,
        duration,
      };
      accumulatedTime += duration;
      return info;
    });
  }, [clips]);

  // Convert raw video time to sequence time
  const rawVideoTimeToSequenceTime = useCallback((rawVideoTime: number): number => {
    let accumulatedSequenceTime = 0;
    
    for (const clipInfo of clipsWithSequenceInfo) {
      const { clip, duration } = clipInfo;
      
      // Check if rawVideoTime falls within this clip's video boundaries
      if (rawVideoTime >= clip.startTime && rawVideoTime < clip.endTime) {
        const offsetInClip = rawVideoTime - clip.startTime;
        return accumulatedSequenceTime + offsetInClip;
      }
      
      accumulatedSequenceTime += duration;
    }
    
    // If not in any clip, return closest position
    if (clips.length > 0 && rawVideoTime < clips[0].startTime) {
      return 0;
    }
    return totalSequenceDuration;
  }, [clipsWithSequenceInfo, clips, totalSequenceDuration]);

  // Convert sequence time to raw video time
  const sequenceTimeToRawVideoTime = useCallback((sequenceTime: number): { rawTime: number; clipInfo: ClipSequenceInfo | null } => {
    const clampedSeqTime = Math.max(0, Math.min(sequenceTime, totalSequenceDuration));
    
    for (const clipInfo of clipsWithSequenceInfo) {
      if (clampedSeqTime >= clipInfo.sequenceStart && clampedSeqTime < clipInfo.sequenceEnd) {
        const offsetInClip = clampedSeqTime - clipInfo.sequenceStart;
        const rawTime = clipInfo.clip.startTime + offsetInClip;
        return { rawTime, clipInfo };
      }
    }
    
    // Edge case: at the very end
    if (clipsWithSequenceInfo.length > 0) {
      const lastClip = clipsWithSequenceInfo[clipsWithSequenceInfo.length - 1];
      if (clampedSeqTime >= lastClip.sequenceEnd - 0.001) {
        return { rawTime: lastClip.clip.endTime, clipInfo: lastClip };
      }
      // At the very beginning
      const firstClip = clipsWithSequenceInfo[0];
      return { rawTime: firstClip.clip.startTime, clipInfo: firstClip };
    }
    
    return { rawTime: 0, clipInfo: null };
  }, [clipsWithSequenceInfo, totalSequenceDuration]);

  // Content styles for zoom
  const contentStyles = useMemo(() => getContentStyles(zoomScale), [zoomScale]);

  // Handle wheel zoom with Ctrl/Cmd key
  const handleWheelZoom = useCallback((event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      
      const now = Date.now();
      if (now - lastZoomTimeRef.current < 16) return;
      lastZoomTimeRef.current = now;
      
      const delta = event.deltaY > 0 ? -ZOOM_CONSTRAINTS.step : ZOOM_CONSTRAINTS.step;
      const newZoom = calculateNewZoom(zoomScale, delta);
      setZoomScale(newZoom);
    }
  }, [zoomScale, setZoomScale, calculateNewZoom]);

  // Set up wheel zoom listener
  useEffect(() => {
    const container = timelineContainerRef.current;
    if (!container) return;
    
    container.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelZoom);
  }, [handleWheelZoom]);


  // Keyboard shortcuts for zoom (+/- keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // + or = key to zoom in
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      }
      // - key to zoom out
      if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut]);

  // Fit timeline to view
  const handleFitToView = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    setZoomScale(1);
    container.scrollLeft = 0;
  }, [setZoomScale]);

  // 60fps Playhead Update using requestAnimationFrame
  useEffect(() => {
    const updatePlayhead = () => {
      const video = videoRef.current;
      if (video && totalSequenceDuration > 0) {
        // Convert raw video time to sequence time for positioning
        const sequenceTime = rawVideoTimeToSequenceTime(video.currentTime);
        const percentage = (sequenceTime / totalSequenceDuration) * 100;
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        
        if (playheadRef.current) {
          playheadRef.current.style.left = `${clampedPercentage}%`;
        }
        if (rulerPlayheadRef.current) {
          rulerPlayheadRef.current.style.left = `calc(${clampedPercentage}% - 6px)`;
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    };
    
    animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoRef, totalSequenceDuration, rawVideoTimeToSequenceTime]);

  // Handle click on timeline to seek - uses SEQUENCE coordinates
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-clip]')) return;
    if (!videoRef.current) return;

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    
    const clickX = e.clientX - rect.left + scrollLeft;
    const contentWidth = container.scrollWidth;
    
    const percentage = clickX / contentWidth;
    // Calculate SEQUENCE time from click position
    const sequenceTime = Math.max(0, Math.min(percentage * totalSequenceDuration, totalSequenceDuration));
    
    // Convert to raw video time
    const { rawTime, clipInfo } = sequenceTimeToRawVideoTime(sequenceTime);
    
    // Seek the video
    videoRef.current.currentTime = rawTime;

    if (clipInfo) {
      onClipSelect(clipInfo.clip.id, clipInfo.clip.startTime);

      // Sync audio if master audio exists
      if (masterAudioUrl && clipInfo.clip.audioStartTime !== undefined && audioRef?.current) {
        const offsetInClip = rawTime - clipInfo.clip.startTime;
        const videoDuration = getClipDuration(clipInfo.clip);
        const audioDuration = (clipInfo.clip.audioEndTime! - clipInfo.clip.audioStartTime!);
        const audioOffset = (offsetInClip / videoDuration) * audioDuration;
        audioRef.current.currentTime = clipInfo.clip.audioStartTime + audioOffset;
      }
      
      // Notify App.tsx for sync
      onSeek?.(rawTime, clipInfo.clip.id, clipInfo.clip.startTime);
    } else {
      onSeek?.(rawTime, null, 0);
    }
  }, [videoRef, audioRef, totalSequenceDuration, sequenceTimeToRawVideoTime, masterAudioUrl, onClipSelect, onSeek]);

  // Handle playhead drag - uses SEQUENCE coordinates
  const handlePlayheadDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const container = scrollContainerRef.current;
    if (!container || !videoRef.current) return;

    let lastRawTime = videoRef.current.currentTime;
    let lastClipInfo: ClipSequenceInfo | null = null;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;
      const mouseX = moveEvent.clientX - rect.left + scrollLeft;
      const contentWidth = container.scrollWidth;
      
      const percentage = Math.max(0, Math.min(1, mouseX / contentWidth));
      const sequenceTime = percentage * totalSequenceDuration;
      
      // Convert to raw video time
      const { rawTime, clipInfo } = sequenceTimeToRawVideoTime(sequenceTime);
      lastRawTime = rawTime;
      lastClipInfo = clipInfo;

      if (videoRef.current) {
        videoRef.current.currentTime = rawTime;
      }

      if (clipInfo) {
        onClipSelect(clipInfo.clip.id, clipInfo.clip.startTime);
        onSeek?.(rawTime, clipInfo.clip.id, clipInfo.clip.startTime);
      } else {
        onSeek?.(rawTime, null, 0);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Final sync
      if (lastClipInfo) {
        onSeek?.(lastRawTime, lastClipInfo.clip.id, lastClipInfo.clip.startTime);
      } else {
        onSeek?.(lastRawTime, null, 0);
      }
    };

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [videoRef, totalSequenceDuration, sequenceTimeToRawVideoTime, onClipSelect, onSeek]);

  // Handle click on ruler area to seek
  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't seek if clicking on the playhead handle
    if ((e.target as HTMLElement).closest('[data-playhead]')) return;
    if (!videoRef.current) return;

    const container = rulerContentRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    // Ruler is now inside the scroll container, so just use direct click position
    const clickX = e.clientX - rect.left;
    const contentWidth = container.scrollWidth;
    
    const percentage = clickX / contentWidth;
    const sequenceTime = Math.max(0, Math.min(percentage * totalSequenceDuration, totalSequenceDuration));
    
    // Convert to raw video time
    const { rawTime, clipInfo } = sequenceTimeToRawVideoTime(sequenceTime);
    
    // Seek the video
    videoRef.current.currentTime = rawTime;

    if (clipInfo) {
      onClipSelect(clipInfo.clip.id, clipInfo.clip.startTime);

      // Sync audio if master audio exists
      if (masterAudioUrl && clipInfo.clip.audioStartTime !== undefined && audioRef?.current) {
        const offsetInClip = rawTime - clipInfo.clip.startTime;
        const videoDuration = getClipDuration(clipInfo.clip);
        const audioDuration = (clipInfo.clip.audioEndTime! - clipInfo.clip.audioStartTime!);
        const audioOffset = (offsetInClip / videoDuration) * audioDuration;
        audioRef.current.currentTime = clipInfo.clip.audioStartTime + audioOffset;
      }
      
      onSeek?.(rawTime, clipInfo.clip.id, clipInfo.clip.startTime);
    } else {
      onSeek?.(rawTime, null, 0);
    }
  }, [videoRef, audioRef, totalSequenceDuration, sequenceTimeToRawVideoTime, masterAudioUrl, onClipSelect, onSeek]);

  // Generate ruler markers based on zoom level - uses SEQUENCE time
  const rulerMarkers = useMemo(() => {
    let majorInterval = RULER.MAJOR_INTERVAL;
    if (zoomScale < 0.5) majorInterval = 30;
    else if (zoomScale < 1) majorInterval = 20;
    else if (zoomScale > 2) majorInterval = 5;
    else if (zoomScale > 5) majorInterval = 2;

    const numMajorMarkers = Math.ceil(totalSequenceDuration / majorInterval) + 1;
    
    return Array.from({ length: numMajorMarkers }, (_, i) => {
      const time = i * majorInterval;
      const percentage = (time / totalSequenceDuration) * 100;
      
      return (
        <div
          key={i}
          className="absolute h-full flex flex-col items-start"
          style={{ left: `${percentage}%` }}
        >
          <span className="text-[9px] font-mono text-zinc-500 pl-1">{formatTime(time)}</span>
          <div className="w-px h-2 bg-zinc-600 mt-0.5" />
        </div>
      );
    });
  }, [totalSequenceDuration, zoomScale]);

  return (
    <div ref={timelineContainerRef} className="flex flex-col bg-[#0f0f12] border-t border-zinc-800/50">
      {/* Timeline Header with Zoom Controls */}
      <div className="h-8 bg-[#16161a] border-b border-zinc-800/30 flex items-center justify-between px-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Timeline</span>
          <span className="text-[9px] text-zinc-600">
            {formatTime(totalSequenceDuration)} total
          </span>
        </div>
        
        <ZoomControls
          zoomScale={zoomScale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomChange={setZoomScale}
          onFitToView={handleFitToView}
          onResetZoom={resetZoom}
        />
      </div>

      {/* Timeline Content Area - Ruler and Tracks share the same scroll */}
      <div className="flex flex-1" style={{ height: '206px' }}>
        {/* Track Labels Column */}
        <div className="w-28 shrink-0 bg-[#16161a] border-r border-zinc-800/30 flex flex-col">
          {/* Ruler Label */}
          <div className="h-6 border-b border-zinc-800/30" />
          {/* Track Labels */}
          <div className="h-14 flex items-center px-3 border-b border-zinc-800/30">
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">CLIPS</span>
          </div>
          <div className="h-14 flex items-center px-3 border-b border-zinc-800/30">
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">POLISHED</span>
          </div>
          <div className="flex-1 flex items-center px-3">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">ISSUES</span>
          </div>
        </div>

        {/* Shared Scroll Container for Ruler + Tracks */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
        >
          {/* Content wrapper with zoom width */}
          <div style={contentStyles} className="relative">
            {/* Time Ruler - Now inside the scroll container */}
            <div 
              ref={rulerContentRef}
              className="h-6 bg-[#16161a] border-b border-zinc-800/30 relative cursor-pointer sticky top-0 z-10"
              onClick={handleRulerClick}
            >
              {rulerMarkers}
              
              {/* Draggable Playhead on Ruler */}
              {clips.length > 0 && (
                <div
                  ref={rulerPlayheadRef}
                  data-playhead="true"
                  className="absolute top-0 bottom-0 w-3 z-20 cursor-grab active:cursor-grabbing group"
                  style={{ left: 'calc(0% - 6px)' }}
                  onMouseDown={handlePlayheadDrag}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2">
                    <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-orange-500 group-hover:border-t-orange-400 transition-colors" />
                  </div>
                  <div className="absolute top-2 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-orange-500 group-hover:bg-orange-400 transition-colors" />
                </div>
              )}
            </div>

            {/* Track Content Area */}
            <div className="relative flex flex-col" onClick={handleTimelineClick}>
              {/* Main Playhead Line - spans all tracks */}
              {clips.length > 0 && (
                <div
                  ref={playheadRef}
                  className="absolute top-0 bottom-0 w-0.5 bg-orange-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(249,115,22,0.5)]"
                  style={{ left: '0%' }}
                />
              )}

              {/* Transcript Clips Track */}
            <div className="h-14 border-b border-zinc-800/30 relative bg-[#1a1a1f]">
              {clipsWithSequenceInfo.map((clipInfo, index) => (
                <TimelineClipItem
                  key={clipInfo.clip.id}
                  clip={clipInfo.clip}
                  index={index}
                  isActive={activeClipId === clipInfo.clip.id}
                  sequenceStart={clipInfo.sequenceStart}
                  sequenceEnd={clipInfo.sequenceEnd}
                  totalSequenceDuration={totalSequenceDuration}
                  onSelect={onClipSelect}
                  onMove={onClipMove}
                  onDelete={onClipDelete}
                />
              ))}
            </div>

            {/* Polished Transcript Track */}
            <div className="h-14 border-b border-zinc-800/30 relative bg-[#18181c]">
              {clipsWithSequenceInfo.map((clipInfo) => (
                <PolishedClipItem
                  key={clipInfo.clip.id}
                  clip={clipInfo.clip}
                  isActive={activeClipId === clipInfo.clip.id}
                  isEditing={editingClipId === clipInfo.clip.id}
                  editingText={editingText}
                  sequenceStart={clipInfo.sequenceStart}
                  sequenceEnd={clipInfo.sequenceEnd}
                  totalSequenceDuration={totalSequenceDuration}
                  masterAudioUrl={masterAudioUrl}
                  onSelect={onClipSelect}
                  onStartEdit={onStartEdit}
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={onCancelEdit}
                  onEditTextChange={onEditTextChange}
                />
              ))}
            </div>

            {/* Issues/Redundancy Track */}
            <div className="flex-1 relative bg-[#1a1a1f]">
              {clipsWithSequenceInfo.map((clipInfo) => {
                const hasRedundancy = clipInfo.clip.redundancies && clipInfo.clip.redundancies.length > 0;
                const leftPercentage = (clipInfo.sequenceStart / totalSequenceDuration) * 100;
                const widthPercentage = Math.max((clipInfo.duration / totalSequenceDuration) * 100, 0.5);

                if (!hasRedundancy) return null;

                return (
                  <div
                    key={clipInfo.clip.id}
                    className="absolute h-8 rounded-md overflow-hidden flex gap-0.5"
                    style={{
                      left: `${leftPercentage}%`,
                      width: `${widthPercentage}%`,
                      minWidth: '40px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                  >
                    {clipInfo.clip.redundancies?.map((issue, idx) => (
                      <div
                        key={idx}
                        className={`flex-1 rounded flex items-center justify-center text-[9px] font-medium cursor-pointer transition-colors ${
                          issue.type === 'silence'
                            ? 'bg-amber-500/70 text-amber-900 hover:bg-amber-500'
                            : 'bg-red-500/70 text-red-100 hover:bg-red-500'
                        }`}
                        onClick={() => onFixRedundancy(clipInfo.clip.id, issue)}
                      >
                        {issue.type === 'silence' ? `${issue.duration}s` : 'Fix'}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            </div>{/* End Track Content Area */}
          </div>{/* End Content wrapper */}
        </div>{/* End Scroll Container */}
      </div>{/* End Timeline Content Area */}

      {/* Zoom indicator */}
      <div className="absolute bottom-2 right-2 px-2 py-1 bg-zinc-900/80 rounded text-[9px] text-zinc-400 font-mono">
        {Math.round(zoomScale * 100)}%
      </div>
    </div>
  );
};

export default Timeline;
