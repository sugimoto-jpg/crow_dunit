import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './tasks.css';
import { TaskApp } from './TaskApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TaskApp />
  </StrictMode>,
);
