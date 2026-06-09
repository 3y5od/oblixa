import type { SidebarSectionModel } from "../sidebar-model";
import { SidebarNavItem } from "./sidebar-nav-item";

export function SidebarSection({
  section,
  collapsed,
  onNavigate,
  tooltipHref,
  setTooltipHref,
  first,
}: {
  section: SidebarSectionModel;
  collapsed: boolean;
  onNavigate: () => void;
  tooltipHref: string | null;
  setTooltipHref: (href: string | null) => void;
  first: boolean;
}) {
  if (section.items.length === 0) return null;
  const hideHeadingVisually = collapsed || first;
  return (
    <section
      className={
        section.variant === "rail"
          ? "mt-2"
          : first
            ? "mt-0 pt-0"
            : "mt-3 border-t border-[var(--sidebar-section-border)] pt-2.5"
      }
    >
      <h2
        id={`${section.id}-heading`}
        className={hideHeadingVisually ? "sr-only" : "ui-caps-1 px-3 text-[10px]"}
        style={hideHeadingVisually ? undefined : { color: "var(--sidebar-heading)" }}
      >
        {section.label}
      </h2>
      <nav
        aria-labelledby={`${section.id}-heading`}
        className={collapsed ? "space-y-1.5" : hideHeadingVisually ? "space-y-1.5" : "mt-2 space-y-1.5"}
      >
        {section.items.map((item, i) => (
          // Subtle grouping in the primary (Core) section: Dashboard breathes
          // away from the work areas, and the final item (Settings) sits a touch
          // apart from the operational group.
          <div
            key={item.href}
            className={`space-y-0.5 ${
              !collapsed && first && (i === 1 || i === section.items.length - 1) ? "mt-2" : ""
            }`}
          >
            <SidebarNavItem
              item={item}
              collapsed={collapsed}
              onNavigate={onNavigate}
              tooltipHref={tooltipHref}
              setTooltipHref={setTooltipHref}
            />
            {!collapsed &&
              item.children.map((child) => (
                <SidebarNavItem
                  key={`${child.name}-${child.href}`}
                  item={child}
                  child
                  collapsed={false}
                  onNavigate={onNavigate}
                  tooltipHref={tooltipHref}
                  setTooltipHref={setTooltipHref}
                />
              ))}
          </div>
        ))}
      </nav>
    </section>
  );
}
