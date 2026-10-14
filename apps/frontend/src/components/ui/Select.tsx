import React from "react";
import { FieldShell } from "./FieldShell";
import { Icon, renderIcon } from "./Icon";
import type { IconName } from "./Icon";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: IconName | React.ReactNode;
  options: Array<string | SelectOption>;
  placeholder?: string;
  optional?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, icon, options, placeholder, optional, className, id: givenId, ...rest }, ref) => {
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
          <select
            {...rest}
            ref={ref}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || hint ? `${id}-hint` : undefined}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options.map((o) => {
              const opt = typeof o === "string" ? { value: o, label: o } : o;
              return (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              );
            })}
          </select>
          <Icon name="chevron-down" size={16} className="iz-field__chevron" />
        </div>
      </FieldShell>
    );
  },
);
Select.displayName = "Select";
