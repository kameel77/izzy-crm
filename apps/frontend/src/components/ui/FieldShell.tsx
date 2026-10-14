import React from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

interface FieldShellProps {
  id: string;
  label?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Shared label / control / hint wrapper for TextField and Select. */
export const FieldShell: React.FC<FieldShellProps> = ({
  id,
  label,
  hint,
  error,
  optional,
  disabled,
  className,
  children,
}) => {
  const hintText = error || hint;
  return (
    <div className={cx("iz-field", error && "iz-field--error", disabled && "iz-field--disabled", className)}>
      {label ? (
        <label className="iz-field__label" htmlFor={id}>
          {label}
          {optional ? <em> (optional)</em> : null}
        </label>
      ) : null}
      {children}
      {hintText ? (
        <div className="iz-field__hint" id={`${id}-hint`}>
          {error ? <Icon name="alert" size={12} /> : null}
          {hintText}
        </div>
      ) : null}
    </div>
  );
};
