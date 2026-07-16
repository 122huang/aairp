export function AppHeader() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
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
        </div>
      </div>
    </header>
  );
}
