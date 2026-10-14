import React from "react";
import { cx } from "./cx";
import { Icon, renderIcon } from "./Icon";
import type { IconName } from "./Icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = the one main action (accent). neutral = black header action. secondary = bordered. ghost = toolbar/icon. danger = destructive confirm. */
  variant?: "primary" | "neutral" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: IconName | React.ReactNode;
  iconRight?: IconName | React.ReactNode;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", icon, iconRight, loading, className, children, type = "button", disabled, ...rest },
    ref,
  ) => {
    const iconOnly = !children && Boolean(icon || loading);
    const iconSize = size === "sm" ? 14 : 16;
    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        disabled={loading ? true : disabled}
        aria-busy={loading ? true : rest["aria-busy"]}
        className={cx("iz-btn", `iz-btn--${variant}`, `iz-btn--${size}`, iconOnly && "iz-btn--icon", className)}
      >
        {loading ? <Icon name="loader" size={iconSize} className="iz-btn__spin" /> : renderIcon(icon, iconSize)}
        {children}
        {renderIcon(iconRight, iconSize)}
      </button>
    );
  },
);
Button.displayName = "Button";
