import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './analysis.css';
import { AnalysisApp } from './AnalysisApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnalysisApp />
  </StrictMode>,
);
