import React from "react";
import { cx } from "./cx";
import { renderIcon } from "./Icon";
import type { IconName } from "./Icon";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  icon?: IconName | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ tone = "neutral", dot, icon, children, className }) => (
  <span className={cx("iz-badge", `iz-badge--${tone}`, className)}>
    {dot ? <span className="iz-badge__dot" aria-hidden="true" /> : null}
    {renderIcon(icon, 12)}
    {children}
  </span>
);
