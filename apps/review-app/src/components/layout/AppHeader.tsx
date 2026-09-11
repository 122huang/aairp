import { useEffect, useState } from 'react';
import { hrefForRoute, resolveAppRoute, type AppRoute } from '@/lib/hash-route';
import { fetchRuntimeModes } from '@/api/evidence';
import { experimentalOpenRiskLabel } from '@/lib/review-runtime';
import { cn } from '@/lib/utils';

function NavLink({ route, label }: { route: AppRoute; label: string }) {
  const current = resolveAppRoute();
  const active =
    route.name === 'history'
      ? current.name === 'history' || current.name === 'case'
      : current.name === route.name;

  return (
    <a
      href={hrefForRoute(route)}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm transition-colors',
        active ? 'bg-orange-50 font-medium text-brand' : 'text-muted-foreground hover:text-ink',
      )}
    >
      {label}
    </a>
  );
}

export function AppHeader() {
  const [openRiskLive, setOpenRiskLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchRuntimeModes()
      .then((modes) => {
        if (!cancelled) setOpenRiskLive(modes.open_risk_mode === 'live');
      })
      .catch(() => {
        if (!cancelled) setOpenRiskLive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const experimentalLabel = experimentalOpenRiskLabel(openRiskLive ? 'live' : 'stub');

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <a href={hrefForRoute({ name: 'single' })} className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand text-[10px] font-bold text-white"
            aria-hidden
          >
            ACH
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight text-ink">Ad Compliance Hub</h1>
            <p className="text-[9.6px] leading-tight text-muted-foreground">广告合规宝</p>
          </div>
        </a>
        <nav className="flex flex-wrap items-center gap-1" aria-label="主导航">
          <NavLink route={{ name: 'single' }} label="单条审查" />
          <NavLink route={{ name: 'batch' }} label="批量审查" />
          <NavLink route={{ name: 'history' }} label="审核记录" />
        </nav>
      </div>
      {experimentalLabel ? (
        <div
          className="border-t border-amber-200 bg-amber-50 px-6 py-2 text-center text-xs font-medium text-amber-950"
          role="status"
        >
          {experimentalLabel}
          ：当前结果含未经 production Legal GT 校准的 live LLM overlay。
        </div>
      ) : null}
    </header>
  );
}
