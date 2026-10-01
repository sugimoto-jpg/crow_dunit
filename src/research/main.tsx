import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './research.css';
import { ResearchApp } from './ResearchApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ResearchApp />
  </StrictMode>,
);
