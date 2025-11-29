import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Timeline Store - Manages drag state, playhead position, and timeline interactions
 * Using Zustand for atomic updates (prevents unnecessary re-renders)
 */

// Type for ghost element data during drag operations
export interface GhostInstanceData {
  id: string;
  left: number;
  width: number;
  top: number;
}

// Type for floating ghost data
export interface FloatingGhostData {
  position: { x: number; y: number };
  width: number;
  isValid: boolean;
  itemData?: {
    type?: string;
    label?: string;
  };
}

// Type for drag information
export interface DragInfoState {
  id: string;
  action: 'move' | 'resize-start' | 'resize-end';
  startX: number;
  startY: number;
  startPosition: number;
  startDuration: number;
  startRow: number;
  ghostLeft?: number;
  ghostWidth?: number;
  ghostTop?: number;
  isValidDrop: boolean;
  currentRow?: number;
  finalSnappedFrom?: number;
  finalSnappedRow?: number;
  currentStart?: number;
  currentDuration?: number;
}

// Type for dragged item snapshot
export interface DraggedItemSnapshot {
  id: string;
  originalStart: number;
  originalDuration: number;
  originalRow: number;
  type?: string;
  label?: string;
  data?: any;
  mediaStart?: number;
  mediaSrcDuration?: number;
}

interface TimelineState {
  ghostMarkerPosition: number | null;
  isDragging: boolean;
  isPlayheadDragging: boolean;
  isContextMenuOpen: boolean;
  
  // Drag and drop state
  ghostElement: GhostInstanceData[] | null;
  floatingGhost: FloatingGhostData | null;
  isValidDrop: boolean;
  dragInfo: DragInfoState | null;
  
  // Current drag position for guidelines
  currentDragPosition: {
    start: number;
    end: number;
    trackIndex: number;
  } | null;
}

interface TimelineActions {
  setGhostMarkerPosition: (position: number | null) => void;
  setIsDragging: (isDragging: boolean) => void;
  setIsPlayheadDragging: (isPlayheadDragging: boolean) => void;
  setIsContextMenuOpen: (isOpen: boolean) => void;
  setGhostElement: (ghostElement: GhostInstanceData[] | null) => void;
  setFloatingGhost: (floatingGhost: FloatingGhostData | null) => void;
  setIsValidDrop: (isValid: boolean) => void;
  setDragInfo: (dragInfo: DragInfoState | null) => void;
  getDragInfo: () => DragInfoState | null;
  setCurrentDragPosition: (position: { start: number; end: number; trackIndex: number } | null) => void;
  resetDragState: () => void;
  clearAllState: () => void;
}

export type ITimelineStore = TimelineState & TimelineActions;

const useTimelineStore = create<ITimelineStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ghostMarkerPosition: null,
      isDragging: false,
      isPlayheadDragging: false,
      isContextMenuOpen: false,
      ghostElement: null,
      floatingGhost: null,
      isValidDrop: true,
      dragInfo: null,
      currentDragPosition: null,

      // Actions
      setGhostMarkerPosition: (position) => set({ ghostMarkerPosition: position }),
      setIsDragging: (isDragging) => set({ isDragging }),
      setIsPlayheadDragging: (isPlayheadDragging) => set({ isPlayheadDragging }),
      setIsContextMenuOpen: (isOpen) => set({ isContextMenuOpen: isOpen }),
      setGhostElement: (ghostElement) => set({ ghostElement }),
      setFloatingGhost: (floatingGhost) => set({ floatingGhost }),
      setIsValidDrop: (isValid) => set({ isValidDrop: isValid }),
      setDragInfo: (dragInfo) => set({ dragInfo }),
      getDragInfo: () => get().dragInfo,
      setCurrentDragPosition: (position) => set({ currentDragPosition: position }),
      
      resetDragState: () => set({
        ghostElement: null,
        floatingGhost: null,
        isValidDrop: false,
        dragInfo: null,
        isDragging: false,
        currentDragPosition: null,
      }),

      clearAllState: () => set({
        ghostMarkerPosition: null,
        isDragging: false,
        isContextMenuOpen: false,
        ghostElement: null,
        floatingGhost: null,
        isValidDrop: true,
        dragInfo: null,
        currentDragPosition: null,
      }),
    }),
    {
      name: 'timeline-store',
      partialize: () => ({}), // Don't persist any state
    }
  )
);

export default useTimelineStore;

