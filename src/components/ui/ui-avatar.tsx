import Image from "next/image";

export interface UiAvatarProps {
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_PX: Record<NonNullable<UiAvatarProps["size"]>, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 40,
};

const TEXT_SIZE: Record<NonNullable<UiAvatarProps["size"]>, string> = {
  xs: "text-[9.5px]",
  sm: "text-[11px]",
  md: "text-[12.5px]",
  lg: "text-[14px]",
};

// Neutral-only palette so avatars carry identity, never severity. No warning
// or danger tones — those colors are reserved for actual state pills.
const PALETTE = [
  { bg: "oklch(0.55 0.08 258)", fg: "oklch(0.98 0.005 250)" }, // muted blue
  { bg: "oklch(0.5 0.06 220)", fg: "oklch(0.98 0.005 250)" }, // slate
  { bg: "oklch(0.52 0.07 280)", fg: "oklch(0.98 0.005 250)" }, // muted indigo
  { bg: "oklch(0.55 0.05 195)", fg: "oklch(0.98 0.005 250)" }, // muted teal
  { bg: "oklch(0.48 0.04 260)", fg: "oklch(0.98 0.005 250)" }, // graphite
  { bg: "oklch(0.58 0.06 240)", fg: "oklch(0.98 0.005 250)" }, // steel
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initialsFor(name?: string | null, email?: string | null): string {
  // v11 visual pass: reject the literal "name" placeholder so the avatar
  // doesn't render "NA" for users whose full_name is unset.
  const realName = name && name.trim() && name.trim() !== "name" ? name.trim() : null;
  const base = realName || (email && email.split("@")[0]) || "";
  if (!base) return "?";
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function UiAvatar({
  name,
  email,
  imageUrl,
  size = "md",
  className,
}: UiAvatarProps) {
  const px = SIZE_PX[size];
  const sizeClass = `inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${TEXT_SIZE[size]}`;

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name ?? email ?? "Member avatar"}
        width={px}
        height={px}
        className={`shrink-0 rounded-full object-cover ${className ?? ""}`}
        style={{ width: px, height: px }}
      />
    );
  }

  const seed = (name ?? email ?? "?").toLowerCase();
  const palette = PALETTE[hashString(seed) % PALETTE.length]!;
  return (
    <span
      aria-label={name ?? email ?? "Member"}
      className={`${sizeClass} ${className ?? ""}`}
      style={{
        width: px,
        height: px,
        background: palette.bg,
        color: palette.fg,
      }}
    >
      {initialsFor(name, email)}
    </span>
  );
}

export interface UiAvatarStackProps {
  users: ReadonlyArray<{ name?: string | null; email?: string | null; imageUrl?: string | null }>;
  max?: number;
  size?: UiAvatarProps["size"];
  className?: string;
}

export function UiAvatarStack({ users, max = 3, size = "sm", className }: UiAvatarStackProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;
  const overlapPx = size === "xs" ? 6 : size === "sm" ? 7 : size === "md" ? 10 : 12;

  return (
    <div className={`inline-flex items-center ${className ?? ""}`}>
      {visible.map((user, idx) => (
        <span
          key={(user.email ?? user.name ?? "") + idx}
          className="relative inline-flex"
          style={{ marginLeft: idx === 0 ? 0 : -overlapPx }}
        >
          <UiAvatar
            name={user.name}
            email={user.email}
            imageUrl={user.imageUrl}
            size={size}
            className="ring-2 ring-[var(--surface-raised)]"
          />
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className="relative inline-flex items-center justify-center rounded-full bg-[var(--surface-contrast)] text-[11px] font-semibold text-[var(--text-secondary)] ring-2 ring-[var(--surface-raised)]"
          style={{
            width: SIZE_PX[size],
            height: SIZE_PX[size],
            marginLeft: -overlapPx,
          }}
          aria-label={`${overflow} more`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
