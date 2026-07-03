import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BatchReviewPage } from '@/pages/BatchReviewPage';
import { ReviewPage } from '@/pages/ReviewPage';
import './index.css';

function resolveRoute(): 'single' | 'batch' {
  return window.location.hash === '#/batch' ? 'batch' : 'single';
}

function App() {
  const [route, setRoute] = useState(resolveRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(resolveRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route === 'batch' ? <BatchReviewPage /> : <ReviewPage />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
