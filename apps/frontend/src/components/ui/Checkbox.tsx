import React from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  description?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className, ...rest }, ref) => (
    <label className={cx("iz-check", rest.disabled && "iz-check--disabled", className)}>
      <input type="checkbox" {...rest} ref={ref} />
      <span className="iz-check__box" aria-hidden="true">
        <Icon name="check" size={12} strokeWidth={2.5} />
      </span>
      <span className="iz-check__text">
        {label}
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  ),
);
Checkbox.displayName = "Checkbox";
