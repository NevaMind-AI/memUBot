export function YumiHeader(): JSX.Element {
  return (
    <header className="h-14 flex items-center justify-between px-5 bg-[var(--glass-bg)] backdrop-blur-xl border-b border-[var(--glass-border)]">
      {/* Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">
          Yumi
        </h1>
      </div>
    </header>
  )
}
