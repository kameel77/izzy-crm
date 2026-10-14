import React from "react";
import { NavLink } from "react-router-dom";
import { cx } from "./cx";
import { renderIcon } from "./Icon";
import type { IconName } from "./Icon";

export interface NavSectionProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export interface NavItemProps {
  icon?: IconName | React.ReactNode;
  label: string;
  count?: number | string;
  /** Count as a red pill (unread, needs action). */
  alert?: boolean;
  active?: boolean;
  className?: string;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  /** Renders a react-router NavLink instead of a button. */
  to?: string;
  end?: boolean;
}

export const NavSection: React.FC<NavSectionProps> = ({ label, children, className }) => (
  <div className={cx("iz-nav-section", className)} role="group" aria-label={label}>
    {label ? <div className="iz-nav-section__label">{label}</div> : null}
    {children}
  </div>
);

export const NavItem: React.FC<NavItemProps> = ({ icon, label, count, alert, active, className, title, onClick, to, end }) => {
  const content = (
    <>
      {renderIcon(icon, 16)}
      <span className="iz-nav-item__label">{label}</span>
      {count != null ? (
        <span className={cx("iz-nav-item__count", alert && "iz-nav-item__count--alert")}>{count}</span>
      ) : null}
    </>
  );

  if (to) {
    return (
      <NavLink to={to} end={end} title={title} onClick={onClick} className={cx("iz-nav-item", className)}>
        {content}
      </NavLink>
    );
  }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cx("iz-nav-item", className)}
      aria-current={active ? "page" : undefined}
    >
      {content}
    </button>
  );
};
