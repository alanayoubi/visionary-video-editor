import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Zoom Store - Manages timeline zoom and scroll state
 * Persisted to localStorage for user preference retention
 */

export const ZOOM_CONSTRAINTS = {
  min: 0.1,
  max: 10,
  step: 0.1,
  default: 1,
  wheelStep: 0.2,
};

interface ZoomState {
  zoomScale: number;
  scrollPosition: number;
}

interface ZoomActions {
  setZoomScale: (scale: number) => void;
  setScrollPosition: (position: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  calculateNewZoom: (delta: number) => number;
}

export type IZoomStore = ZoomState & ZoomActions;

const useZoomStore = create<IZoomStore>()(
  persist(
    (set, get) => ({
      // Initial state
      zoomScale: ZOOM_CONSTRAINTS.default,
      scrollPosition: 0,

      // Actions
      setZoomScale: (scale) => set({ 
        zoomScale: Math.max(
          ZOOM_CONSTRAINTS.min, 
          Math.min(ZOOM_CONSTRAINTS.max, scale)
        ) 
      }),
      
      setScrollPosition: (position) => set({ scrollPosition: Math.max(0, position) }),
      
      zoomIn: () => {
        const { zoomScale } = get();
        const newScale = Math.min(ZOOM_CONSTRAINTS.max, zoomScale + ZOOM_CONSTRAINTS.step);
        set({ zoomScale: newScale });
      },
      
      zoomOut: () => {
        const { zoomScale } = get();
        const newScale = Math.max(ZOOM_CONSTRAINTS.min, zoomScale - ZOOM_CONSTRAINTS.step);
        set({ zoomScale: newScale });
      },
      
      resetZoom: () => set({ 
        zoomScale: ZOOM_CONSTRAINTS.default, 
        scrollPosition: 0 
      }),

      calculateNewZoom: (delta: number) => {
        const { zoomScale } = get();
        return Math.min(
          ZOOM_CONSTRAINTS.max,
          Math.max(ZOOM_CONSTRAINTS.min, zoomScale + delta * ZOOM_CONSTRAINTS.step)
        );
      },
    }),
    {
      name: 'zoom-store',
      partialize: (state) => ({ zoomScale: state.zoomScale }),
    }
  )
);

export default useZoomStore;

