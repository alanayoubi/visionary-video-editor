import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlaybackStore } from '../stores';

/**
 * useVideoPlayer Hook
 * 
 * Optimized video player hook with:
 * - requestAnimationFrame-based frame updates (throttled)
 * - Zustand for atomic state updates
 * - Memoized callbacks to prevent re-renders
 * - Proper cleanup on unmount
 */

interface UseVideoPlayerOptions {
  fps?: number;
  autoPlay?: boolean;
}

export const useVideoPlayer = (
  videoRef: React.RefObject<HTMLVideoElement>,
  options: UseVideoPlayerOptions = {}
) => {
  const { fps = 30, autoPlay = false } = options;
  
  const {
    isPlaying,
    currentFrame,
    currentTime,
    playbackRate,
    volume,
    isMuted,
    duration,
    setIsPlaying,
    setCurrentFrame,
    setCurrentTime,
    setDuration,
    setFps,
    play: storePlay,
    pause: storePause,
    togglePlayPause: storeToggle,
    seekToTime,
    reset,
  } = usePlaybackStore();

  // Refs for performance
  const animationFrameRef = useRef<number>();
  const lastUpdateTimeRef = useRef(0);
  const frameIntervalRef = useRef(1000 / fps);

  // Set fps in store on mount
  useEffect(() => {
    setFps(fps);
    frameIntervalRef.current = 1000 / fps;
  }, [fps, setFps]);

  // Frame update loop using requestAnimationFrame (throttled)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateCurrentFrame = (timestamp: number) => {
      const elapsed = timestamp - lastUpdateTimeRef.current;
      
      // Only update at the target frame rate
      if (elapsed >= frameIntervalRef.current) {
        if (video && !video.paused) {
          const frame = Math.round(video.currentTime * fps);
          setCurrentFrame(frame);
        }
        lastUpdateTimeRef.current = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(updateCurrentFrame);
    };

    // Start the animation frame loop
    animationFrameRef.current = requestAnimationFrame(updateCurrentFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [fps, setCurrentFrame, videoRef]);

  // Sync video element state with store
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleTimeUpdate = () => {
      // Fallback for when RAF is not catching updates
      if (!isPlaying) {
        setCurrentTime(video.currentTime);
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);

    // Set initial duration if video is already loaded
    if (video.duration) {
      setDuration(video.duration);
    }

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoRef, setIsPlaying, setDuration, setCurrentTime, isPlaying]);

  // Sync playbackRate with video element
  useEffect(() => {
    const video = videoRef.current;
    if (video && video.playbackRate !== playbackRate) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate, videoRef]);

  // Sync volume with video element
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
      video.muted = isMuted;
    }
  }, [volume, isMuted, videoRef]);

  // Play function
  const play = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.play().catch(console.error);
      storePlay();
    }
  }, [videoRef, storePlay]);

  // Pause function
  const pause = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      storePause();
    }
  }, [videoRef, storePause]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      if (video.paused) {
        play();
      } else {
        pause();
      }
    }
  }, [videoRef, play, pause]);

  // Seek to specific time
  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (video) {
      const clampedTime = Math.max(0, Math.min(time, video.duration || 0));
      video.currentTime = clampedTime;
      seekToTime(clampedTime);
    }
  }, [videoRef, seekToTime]);

  // Seek to specific frame
  const seekToFrame = useCallback((frame: number) => {
    const time = frame / fps;
    seekTo(time);
  }, [fps, seekTo]);

  // Format time as MM:SS.FF
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * fps);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
  }, [fps]);

  // Skip forward/backward by seconds
  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (video) {
      seekTo(video.currentTime + seconds);
    }
  }, [videoRef, seekTo]);

  return {
    // State
    isPlaying,
    currentFrame,
    currentTime,
    playbackRate,
    volume,
    isMuted,
    duration,
    fps,
    
    // Actions
    play,
    pause,
    togglePlayPause,
    seekTo,
    seekToFrame,
    skip,
    formatTime,
    reset,
  };
};

