interface HeaderProps {
  fullName?: string | null;
  email?: string | null;
}

export function Header({ fullName, email }: HeaderProps) {
  const displayName = fullName || email || "User";
  const initial = (fullName?.[0] || email?.[0] || "?").toUpperCase();

  return (
    <header className="flex h-[3.75rem] shrink-0 items-center justify-between border-b border-zinc-200/70 bg-white/90 px-6 backdrop-blur-md md:px-8">
      <div className="hidden sm:block" aria-hidden />
      <div
        className="flex items-center gap-3.5"
        aria-label={`Signed in as ${displayName}`}
      >
        <div className="text-right">
          <p className="text-sm font-semibold tracking-tight text-zinc-900">
            {displayName}
          </p>
          {fullName && email && (
            <p className="text-xs text-zinc-500">{email}</p>
          )}
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50 to-zinc-100/80 text-sm font-semibold text-zinc-700 shadow-sm transition-[box-shadow,border-color] duration-200 ease-out"
          aria-hidden
        >
          {initial}
        </div>
      </div>
    </header>
  );
}
