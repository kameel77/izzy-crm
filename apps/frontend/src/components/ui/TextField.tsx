import React from "react";
import { FieldShell } from "./FieldShell";
import { renderIcon } from "./Icon";
import type { IconName } from "./Icon";

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  /** Replaces hint, turns the border danger and sets aria-invalid. */
  error?: string;
  icon?: IconName | React.ReactNode;
  suffix?: React.ReactNode;
  optional?: boolean;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, icon, suffix, optional, className, id: givenId, ...rest }, ref) => {
    const generatedId = React.useId();
    const id = givenId || generatedId;
    return (
      <FieldShell
        id={id}
        label={label}
        hint={hint}
        error={error}
        optional={optional}
        disabled={rest.disabled}
        className={className}
      >
        <div className="iz-field__control">
          {renderIcon(icon, 16)}
          <input
            type="text"
            {...rest}
            ref={ref}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || hint ? `${id}-hint` : undefined}
          />
          {suffix || null}
        </div>
      </FieldShell>
    );
  },
);
TextField.displayName = "TextField";
