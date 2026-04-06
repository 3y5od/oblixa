interface HeaderProps {
  fullName?: string | null;
  email?: string | null;
}

export function Header({ fullName, email }: HeaderProps) {
  const displayName = fullName || email || "User";
  const initial = (fullName?.[0] || email?.[0] || "?").toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200/90 bg-surface px-6 md:px-8">
      <div />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold tracking-tight text-zinc-900">{displayName}</p>
          {fullName && email && (
            <p className="text-xs text-zinc-500">{email}</p>
          )}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200/90 bg-zinc-50 text-sm font-semibold text-zinc-700">
          {initial}
        </div>
      </div>
    </header>
  );
}
