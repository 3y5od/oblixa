interface HeaderProps {
  fullName?: string | null;
  email?: string | null;
}

export function Header({ fullName, email }: HeaderProps) {
  const displayName = fullName || email || "User";
  const initial = (fullName?.[0] || email?.[0] || "?").toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{displayName}</p>
          {fullName && email && (
            <p className="text-xs text-gray-500">{email}</p>
          )}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
          {initial}
        </div>
      </div>
    </header>
  );
}
