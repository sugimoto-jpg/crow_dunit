import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../research/research.css';
import { BonusApp } from './BonusApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BonusApp />
  </StrictMode>,
);
