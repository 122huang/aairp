import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReviewHubPage } from '@/pages/ReviewHubPage';
import type { ReviewMode } from '@/components/review/ReviewModeTabs';
import './index.css';

function resolveInitialMode(): ReviewMode {
  return window.location.hash === '#/batch' ? 'batch' : 'single';
}

function App() {
  const [mode, setMode] = useState<ReviewMode>(resolveInitialMode);

  useEffect(() => {
    const onHashChange = () => setMode(resolveInitialMode());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return <ReviewHubPage initialMode={mode} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
