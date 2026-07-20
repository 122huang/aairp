export type AppRoute =
  | { name: 'single'; parentCaseId?: string }
  | { name: 'batch' }
  | { name: 'history' }
  | { name: 'case'; caseId: string };

function parseHashQuery(raw: string): URLSearchParams {
  const qIndex = raw.indexOf('?');
  if (qIndex < 0) return new URLSearchParams();
  return new URLSearchParams(raw.slice(qIndex + 1));
}

export function resolveAppRoute(hash = window.location.hash): AppRoute {
  const raw = hash.replace(/^#/, '') || '/';
  const path = raw.split('?')[0] || '/';
  const query = parseHashQuery(raw);

  if (path === '/batch') return { name: 'batch' };
  if (path === '/history') return { name: 'history' };

  const caseMatch = path.match(/^\/cases\/([^/]+)$/);
  if (caseMatch?.[1]) {
    return { name: 'case', caseId: decodeURIComponent(caseMatch[1]) };
  }

  const parentCaseId = query.get('parent_case_id')?.trim() || undefined;
  return { name: 'single', ...(parentCaseId ? { parentCaseId } : {}) };
}

export function hrefForRoute(route: AppRoute): string {
  switch (route.name) {
    case 'batch':
      return '#/batch';
    case 'history':
      return '#/history';
    case 'case':
      return `#/cases/${encodeURIComponent(route.caseId)}`;
    case 'single':
      return route.parentCaseId
        ? `#/?parent_case_id=${encodeURIComponent(route.parentCaseId)}`
        : '#/';
  }
}
