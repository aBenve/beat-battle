import { create } from 'zustand';

interface UIState {
  // Dialog states
  showAddSong: boolean;
  setShowAddSong: (show: boolean) => void;

  // Misc UI states
  copiedCode: boolean;
  setCopiedCode: (copied: boolean) => void;

  // Loading states
  isPlayerReady: boolean;
  setIsPlayerReady: (ready: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  showAddSong: false,
  setShowAddSong: (show) => set({ showAddSong: show }),

  copiedCode: false,
  setCopiedCode: (copied) => set({ copiedCode: copied }),

  isPlayerReady: false,
  setIsPlayerReady: (ready) => set({ isPlayerReady: ready }),
}));
