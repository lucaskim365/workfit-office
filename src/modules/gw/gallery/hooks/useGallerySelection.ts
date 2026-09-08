import { useState, useCallback } from 'react';
import type { GalleryItem } from '../types';

export function useGallerySelection(filteredItems: GalleryItem[]) {
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const isSelectionMode = selectedItemIds.size > 0;

  const toggleSelectItem = useCallback((id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedItemIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map((it) => it.id)));
    }
  }, [filteredItems, selectedItemIds.size]);

  const handleCancelSelection = useCallback(() => {
    setSelectedItemIds(new Set());
  }, []);

  const enterSelectionMode = useCallback(() => {
    // 호환성을 위해 유지
  }, []);

  return {
    isSelectionMode,
    setIsSelectionMode: (val: boolean) => {
      if (!val) setSelectedItemIds(new Set());
    },
    selectedItemIds,
    setSelectedItemIds,
    toggleSelectItem,
    handleSelectAll,
    handleCancelSelection,
    enterSelectionMode,
  };
}
