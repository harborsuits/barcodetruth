import { useSyncExternalStore } from 'react';
import type { ShoppingReason } from '@/lib/shoppingLens';

// Deliberately memory-only: survives in-app navigation, never goes in URLs, analytics,
// account records or an advertising profile. A full reload clears the selection.
let currentReason: ShoppingReason = 'ownership';
const subscribers = new Set<() => void>();
const subscribe = (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; };
export function useShoppingLens() {
  const reason = useSyncExternalStore(subscribe, () => currentReason, () => 'ownership' as ShoppingReason);
  return [reason, (next: ShoppingReason) => { currentReason = next; subscribers.forEach(listener => listener()); }] as const;
}
