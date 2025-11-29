import { create } from 'zustand';

/**
 * Playback Store - Manages video playback state with atomic updates
 * Separating playback state prevents re-renders of non-playback components
 */

interface PlaybackState {
  isPlaying: boolean;
  currentFrame: number;
  currentTime: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  duration: number;
  fps: number;
}

interface PlaybackActions {
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentFrame: (frame: number) => void;
  setCurrentTime: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (isMuted: boolean) => void;
  setDuration: (duration: number) => void;
  setFps: (fps: number) => void;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seekToFrame: (frame: number) => void;
  seekToTime: (time: number) => void;
  reset: () => void;
}

export type IPlaybackStore = PlaybackState & PlaybackActions;

const DEFAULT_FPS = 30;

const usePlaybackStore = create<IPlaybackStore>()((set, get) => ({
  // Initial state
  isPlaying: false,
  currentFrame: 0,
  currentTime: 0,
  playbackRate: 1,
  volume: 1,
  isMuted: false,
  duration: 0,
  fps: DEFAULT_FPS,

  // Actions
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentFrame: (frame) => set({ 
    currentFrame: frame, 
    currentTime: frame / get().fps 
  }),
  setCurrentTime: (time) => set({ 
    currentTime: time, 
    currentFrame: Math.round(time * get().fps) 
  }),
  setPlaybackRate: (rate) => set({ playbackRate: Math.max(0.1, Math.min(4, rate)) }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setDuration: (duration) => set({ duration }),
  setFps: (fps) => set({ fps }),

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  seekToFrame: (frame) => {
    const { fps, duration } = get();
    const maxFrame = Math.floor(duration * fps);
    const clampedFrame = Math.max(0, Math.min(frame, maxFrame));
    set({ 
      currentFrame: clampedFrame, 
      currentTime: clampedFrame / fps 
    });
  },
  
  seekToTime: (time) => {
    const { fps, duration } = get();
    const clampedTime = Math.max(0, Math.min(time, duration));
    set({ 
      currentTime: clampedTime, 
      currentFrame: Math.round(clampedTime * fps) 
    });
  },

  reset: () => set({
    isPlaying: false,
    currentFrame: 0,
    currentTime: 0,
  }),
}));

export default usePlaybackStore;

