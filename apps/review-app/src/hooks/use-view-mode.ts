import { useState } from 'react';

export type ViewMode = 'legal' | 'business';

const STORAGE_KEY = 'ach-view-mode';

function readStoredViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'business' ? 'business' : 'legal';
  } catch {
    return 'legal';
  }
}

export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredViewMode);

  function updateViewMode(mode: ViewMode) {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore quota / private mode errors
    }
  }

  return [viewMode, updateViewMode];
}
