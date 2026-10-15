import React from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  Inbox,
  Info,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  MoreHorizontal,
  PanelLeft,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cx } from "./cx";

export type IconName =
  | "plus" | "search" | "chevron-down" | "chevron-right" | "chevron-left" | "arrow-up-right" | "arrow-down-right"
  | "check" | "x" | "more" | "dashboard" | "users" | "briefcase" | "chart" | "file" | "shield" | "sliders"
  | "bell" | "calendar" | "mail" | "filter" | "download" | "clock" | "info" | "alert" | "car" | "wallet" | "loader"
  | "archive" | "panel-left" | "log-out" | "refresh" | "inbox";

export interface IconProps {
  name: IconName;
  /** px, default 16 (use 20 only in empty states). */
  size?: number;
  strokeWidth?: number;
  /** Give a title only when the icon carries meaning on its own. */
  title?: string;
  className?: string;
}

const ICONS: Record<IconName, LucideIcon> = {
  plus: Plus,
  search: Search,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "chevron-left": ChevronLeft,
  "arrow-up-right": ArrowUpRight,
  "arrow-down-right": ArrowDownRight,
  check: Check,
  x: X,
  more: MoreHorizontal,
  dashboard: LayoutDashboard,
  users: Users,
  briefcase: Briefcase,
  chart: BarChart3,
  file: FileText,
  shield: ShieldCheck,
  sliders: SlidersHorizontal,
  bell: Bell,
  calendar: Calendar,
  mail: Mail,
  filter: Filter,
  download: Download,
  clock: Clock,
  info: Info,
  alert: AlertTriangle,
  car: Car,
  wallet: Wallet,
  loader: Loader2,
  archive: Archive,
  "panel-left": PanelLeft,
  "log-out": LogOut,
  refresh: RefreshCw,
  inbox: Inbox,
};

export const Icon: React.FC<IconProps> = ({ name, size, strokeWidth, title, className }) => {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return (
    <Cmp
      className={cx("iz-icon", className)}
      size={size ?? 16}
      strokeWidth={strokeWidth ?? 1.75}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    />
  );
};

export function renderIcon(icon: IconName | React.ReactNode | undefined, size: number): React.ReactNode {
  if (!icon) return null;
  return typeof icon === "string" ? <Icon name={icon as IconName} size={size} /> : icon;
}
