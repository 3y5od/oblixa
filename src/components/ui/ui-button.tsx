import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { UiSpinner } from "@/components/ui/ui-spinner";

export type UiButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type UiButtonSize = "xs" | "sm" | "md" | "lg";

const VARIANT_CLASS: Record<UiButtonVariant, string> = {
  primary: "ui-btn-primary",
  secondary: "ui-btn-secondary",
  ghost: "ui-btn-ghost",
  danger: "ui-btn-danger",
};

const SIZE_CLASS: Record<UiButtonSize, string> = {
  xs: "px-2 py-1 text-[11px] min-h-7",
  sm: "px-3 py-1.5 text-[12.5px] min-h-8",
  md: "px-3.5 py-2 text-[12.5px] min-h-9",
  lg: "px-4 py-2.5 text-[12.5px] min-h-10",
};

const ICON_ONLY_SIZE: Record<UiButtonSize, string> = {
  xs: "h-7 w-7 p-0",
  sm: "h-8 w-8 p-0",
  md: "h-9 w-9 p-0",
  lg: "h-10 w-10 p-0",
};

interface CommonProps {
  variant?: UiButtonVariant;
  size?: UiButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  iconOnly?: boolean;
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
}

type UiButtonAsButtonProps = CommonProps &
  Omit<ComponentProps<"button">, "className" | "children">;

type UiButtonAsAnchorProps = CommonProps &
  Omit<ComponentProps<typeof Link>, "className" | "children"> & {
    href: string;
  };

export type UiButtonProps = UiButtonAsButtonProps | UiButtonAsAnchorProps;

function isAnchor(props: UiButtonProps): props is UiButtonAsAnchorProps {
  return "href" in props && props.href != null;
}

function stripUiButtonProps<T extends Record<string, unknown>>(props: T): T {
  const rest = { ...props };
  delete rest.variant;
  delete rest.size;
  delete rest.loading;
  delete rest.icon;
  delete rest.iconPosition;
  delete rest.iconOnly;
  delete rest.ariaLabel;
  delete rest.className;
  delete rest.children;
  return rest;
}

export function UiButton(props: UiButtonProps) {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    iconPosition = "left",
    iconOnly = false,
    ariaLabel,
    className,
    children,
  } = props;

  const sizeClass = iconOnly ? ICON_ONLY_SIZE[size] : SIZE_CLASS[size];
  const composed = `${VARIANT_CLASS[variant]} inline-flex items-center justify-center gap-1.5 ${sizeClass} ${
    className ?? ""
  }`;

  const inner = (
    <>
      {loading ? (
        <UiSpinner size={size === "xs" ? "xs" : "sm"} />
      ) : icon && iconPosition === "left" ? (
        <span aria-hidden className="inline-flex shrink-0">
          {icon}
        </span>
      ) : null}
      {iconOnly ? null : <span>{children}</span>}
      {!loading && icon && iconPosition === "right" && !iconOnly ? (
        <span aria-hidden className="inline-flex shrink-0">
          {icon}
        </span>
      ) : null}
    </>
  );

  if (isAnchor(props)) {
    const { href, ...rest } = props;
    return (
      <Link
        {...(stripUiButtonProps(rest) as ComponentProps<typeof Link>)}
        href={href}
        aria-label={ariaLabel}
        className={composed}
      >
        {inner}
      </Link>
    );
  }

  const { disabled, type = "button", ...rest } = props as UiButtonAsButtonProps;
  return (
    <button
      {...stripUiButtonProps(rest)}
      type={type}
      disabled={loading || disabled}
      aria-label={ariaLabel}
      className={composed}
    >
      {inner}
    </button>
  );
}
