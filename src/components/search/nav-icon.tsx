import {
  BadgeCheck,
  BarChart3,
  Bell,
  BellRing,
  Boxes,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Compass,
  CreditCard,
  Download,
  FileCheck2,
  Files,
  GitBranch,
  Grid2x2,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  SearchCheck,
  Settings,
  Shield,
  ShieldCheck,
  Upload,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/navigation";

/** Maps a NavItem.icon token to a lucide-react icon. Kept in one place so the
 *  sidebar, search results, and any future surface render the same glyph for
 *  the same destination.
 *
 *  Imports are static per-icon (not the dynamic `lucide-react` namespace
 *  import) so tree-shaking keeps the bundle bounded.
 */
const ICON_BY_KEY: Record<NonNullable<NavItem["icon"]>, LucideIcon> = {
  dashboard: LayoutDashboard,
  review: SearchCheck,
  contracts: Files,
  tasks: ListTodo,
  renewals: CalendarClock,
  exceptions: BellRing,
  evidence: FileCheck2,
  reports: BarChart3,
  decisions: BadgeCheck,
  campaigns: Megaphone,
  assurance: Shield,
  relationships: GitBranch,
  programs: Boxes,
  settings: Settings,
  billing: CreditCard,
  more: Grid2x2,
  profile: UserRound,
  "workspace-identity": Building2,
  team: Users,
  imports: Upload,
  "security-account": ShieldCheck,
  notifications: Bell,
  export: Download,
  "review-fields": ClipboardCheck,
};

/** Default fallback for items without an explicit `icon` token. A neutral
 *  Compass keeps the icon column visually balanced — every row must render
 *  an icon at a stable left edge to preserve scan rhythm. */
export const DEFAULT_NAV_ICON: LucideIcon = Compass;

export function resolveNavIcon(item: Pick<NavItem, "icon">): LucideIcon {
  if (item.icon) return ICON_BY_KEY[item.icon];
  return DEFAULT_NAV_ICON;
}
