import { useCallback, useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { usePlaybackStore, useZoomStore } from '../stores';

/**
 * useKeyboardShortcuts Hook
 * 
 * Provides keyboard shortcuts for timeline and video player controls.
 * Uses react-hotkeys-hook for optimized key handling.
 * 
 * Shortcuts:
 * - Space: Toggle play/pause
 * - J/L: Seek backward/forward 5 seconds
 * - K: Pause
 * - Arrow Left/Right: Frame step backward/forward
 * - Ctrl/Cmd + Z: Undo
 * - Ctrl/Cmd + Shift + Z: Redo
 * - Ctrl/Cmd + +/-: Zoom in/out
 * - Home/End: Seek to start/end
 */

interface KeyboardShortcutOptions {
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  seekAmount?: number;
  videoRef?: React.RefObject<HTMLVideoElement>;
}

export const useKeyboardShortcuts = (options: KeyboardShortcutOptions = {}) => {
  const { 
    onUndo, 
    onRedo, 
    canUndo = false, 
    canRedo = false,
    seekAmount = 5,
    videoRef,
  } = options;

  const { 
    isPlaying, 
    togglePlayPause, 
    pause,
    fps,
    currentTime,
    duration,
  } = usePlaybackStore();
  
  const { zoomIn, zoomOut, resetZoom } = useZoomStore();

  // Seek function using video ref
  const seekTo = useCallback((time: number) => {
    if (videoRef?.current) {
      const clampedTime = Math.max(0, Math.min(time, videoRef.current.duration || duration));
      videoRef.current.currentTime = clampedTime;
    }
  }, [videoRef, duration]);

  // Space: Toggle play/pause
  useHotkeys('space', (e) => {
    e.preventDefault();
    togglePlayPause();
  }, { enableOnFormTags: false }, [togglePlayPause]);

  // K: Pause
  useHotkeys('k', (e) => {
    e.preventDefault();
    pause();
  }, { enableOnFormTags: false }, [pause]);

  // J: Seek backward
  useHotkeys('j', (e) => {
    e.preventDefault();
    seekTo(currentTime - seekAmount);
  }, { enableOnFormTags: false }, [currentTime, seekAmount, seekTo]);

  // L: Seek forward
  useHotkeys('l', (e) => {
    e.preventDefault();
    seekTo(currentTime + seekAmount);
  }, { enableOnFormTags: false }, [currentTime, seekAmount, seekTo]);

  // Arrow Left: Frame step backward
  useHotkeys('left', (e) => {
    e.preventDefault();
    const frameTime = 1 / fps;
    seekTo(currentTime - frameTime);
  }, { enableOnFormTags: false }, [currentTime, fps, seekTo]);

  // Arrow Right: Frame step forward
  useHotkeys('right', (e) => {
    e.preventDefault();
    const frameTime = 1 / fps;
    seekTo(currentTime + frameTime);
  }, { enableOnFormTags: false }, [currentTime, fps, seekTo]);

  // Home: Seek to start
  useHotkeys('home', (e) => {
    e.preventDefault();
    seekTo(0);
  }, { enableOnFormTags: false }, [seekTo]);

  // End: Seek to end
  useHotkeys('end', (e) => {
    e.preventDefault();
    seekTo(duration);
  }, { enableOnFormTags: false }, [duration, seekTo]);

  // Ctrl/Cmd + Z: Undo
  useHotkeys('mod+z', (e) => {
    e.preventDefault();
    if (canUndo && onUndo) {
      onUndo();
    }
  }, { enableOnFormTags: false }, [canUndo, onUndo]);

  // Ctrl/Cmd + Shift + Z: Redo
  useHotkeys('mod+shift+z', (e) => {
    e.preventDefault();
    if (canRedo && onRedo) {
      onRedo();
    }
  }, { enableOnFormTags: false }, [canRedo, onRedo]);

  // Ctrl/Cmd + =: Zoom in
  useHotkeys('mod+=', (e) => {
    e.preventDefault();
    zoomIn();
  }, { enableOnFormTags: false }, [zoomIn]);

  // Ctrl/Cmd + -: Zoom out
  useHotkeys('mod+-', (e) => {
    e.preventDefault();
    zoomOut();
  }, { enableOnFormTags: false }, [zoomOut]);

  // Ctrl/Cmd + 0: Reset zoom
  useHotkeys('mod+0', (e) => {
    e.preventDefault();
    resetZoom();
  }, { enableOnFormTags: false }, [resetZoom]);

  return {
    togglePlayPause,
    pause,
    seekTo,
    zoomIn,
    zoomOut,
    resetZoom,
  };
};

