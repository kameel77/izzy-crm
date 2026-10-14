import React from "react";
import { cx } from "./cx";
import { renderIcon } from "./Icon";
import type { IconName } from "./Icon";

export interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: IconName | React.ReactNode;
  /** Right side of the header: ghost sm Buttons, a SegmentedControl. */
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Body without side padding — for a DataTable or a full-bleed chart. */
  flush?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ title, subtitle, icon, actions, footer, flush, children, className, style }) => {
  const hasHead = title || actions || icon;
  return (
    <section className={cx("iz-card", className)} style={style}>
      {hasHead ? (
        <header className="iz-card__head">
          {icon ? <span className="iz-card__icon">{renderIcon(icon, 16)}</span> : null}
          {title ? (
            <div>
              <h3 className="iz-card__title">{title}</h3>
              {subtitle ? <div className="iz-card__sub">{subtitle}</div> : null}
            </div>
          ) : null}
          {actions ? <div className="iz-card__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cx("iz-card__body", flush && "iz-card__body--flush")}>{children}</div>
      {footer ? <footer className="iz-card__foot">{footer}</footer> : null}
    </section>
  );
};
