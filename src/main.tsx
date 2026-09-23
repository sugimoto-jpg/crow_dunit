import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { bootSaveSystem, getSaveManager } from './save';
import { useSaveStatus } from './save/useSaveStatus';
import { BootLoading, RecoveryScreen } from './components/BootScreens';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SaveToasts } from './components/SaveToasts';

/** セーブデータを読み込んでからゲームを表示する（読み込み前の初期状態で上書きしないため） */
function Root() {
  const [ready, setReady] = useState(() => getSaveManager() != null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    bootSaveSystem()
      .then(() => setReady(true))
      .catch((e: Error) => setError(e.message || String(e)));
  }, []);
  if (!ready) return <BootLoading error={error} />;
  return <Gate />;
}

function Gate() {
  const status = useSaveStatus();
  return (
    <>
      {status.phase === 'needs-decision' ? (
        <RecoveryScreen />
      ) : status.phase === 'ready' ? (
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      ) : (
        <BootLoading />
      )}
      <SaveToasts />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
