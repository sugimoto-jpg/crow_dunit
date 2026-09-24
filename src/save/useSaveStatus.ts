import { useSyncExternalStore } from 'react';
import { getSaveManager } from './index';
import type { SaveStatus } from './SaveManager';

const BOOTING: SaveStatus = {
  phase: 'booting',
  boot: null,
  backends: [],
  durable: true,
  persisted: null,
  saving: false,
  lastSavedAt: null,
  lastError: null,
  saveCount: 0,
  revision: 0,
  conflict: false,
  toasts: [],
};

const noop = () => () => undefined;

/** SaveManager の状態を React で読む（起動前は booting を返す） */
export function useSaveStatus(): SaveStatus {
  const m = getSaveManager();
  return useSyncExternalStore(m ? m.subscribe : noop, m ? m.getStatus : () => BOOTING);
}
