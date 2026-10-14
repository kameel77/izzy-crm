import React from "react";
import { cx } from "./cx";

export interface AvatarProps {
  /** Full name — initials and tint are derived from it. */
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface AvatarGroupProps {
  names: string[];
  max?: number;
  size?: "sm" | "md" | "lg";
}

function initials(name: string): string {
  const p = String(name || "?").trim().split(/\s+/);
  const first = (p[0] || "")[0] || "";
  const last = (p.length > 1 ? p[p.length - 1] : "")[0] || "";
  return (first + last).toUpperCase();
}

function tint(name: string): number {
  let n = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n % 5;
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = "md", className }) => (
  <span
    className={cx("iz-avatar", `iz-avatar--${size}`, !src && `iz-avatar--t${tint(name)}`, className)}
    title={name}
    role="img"
    aria-label={name}
  >
    {src ? <img src={src} alt="" /> : initials(name)}
  </span>
);

export const AvatarGroup: React.FC<AvatarGroupProps> = ({ names, max = 3, size = "sm" }) => {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className="iz-avatar-group">
      {shown.map((n) => (
        <Avatar key={n} name={n} size={size} />
      ))}
      {extra > 0 ? (
        <span className={cx("iz-avatar", `iz-avatar--${size}`, "iz-avatar--t4")} aria-label={`+${extra} more`}>
          +{extra}
        </span>
      ) : null}
    </span>
  );
};
