import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CaseDetailPage } from '@/pages/CaseDetailPage';
import { ReviewHistoryPage } from '@/pages/ReviewHistoryPage';
import { ReviewHubPage } from '@/pages/ReviewHubPage';
import { resolveAppRoute, type AppRoute } from '@/lib/hash-route';
import './index.css';

function App() {
  const [route, setRoute] = useState<AppRoute>(() => resolveAppRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(resolveAppRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (route.name === 'history') {
    return <ReviewHistoryPage />;
  }
  if (route.name === 'case') {
    return <CaseDetailPage caseId={route.caseId} />;
  }

  return (
    <ReviewHubPage
      initialMode={route.name === 'batch' ? 'batch' : 'single'}
      initialParentCaseId={route.name === 'single' ? route.parentCaseId : undefined}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
