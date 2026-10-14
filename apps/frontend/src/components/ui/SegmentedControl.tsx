import React from "react";
import { cx } from "./cx";

export interface SegmentedControlProps {
  options: Array<string | { value: string; label: React.ReactNode }>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md";
  "aria-label": string;
  className?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value: controlled,
  defaultValue,
  onChange,
  size,
  className,
  "aria-label": ariaLabel,
}) => {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o as React.ReactNode } : o));
  const [inner, setInner] = React.useState<string | undefined>(defaultValue ?? opts[0]?.value);
  const value = controlled != null ? controlled : inner;
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const pick = (v: string) => {
    if (controlled == null) setInner(v);
    onChange?.(v);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = (index + delta + opts.length) % opts.length;
    pick(opts[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className={cx("iz-seg", size === "sm" && "iz-seg--sm", className)} role="radiogroup" aria-label={ariaLabel}>
      {opts.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          className="iz-seg__opt"
          aria-checked={o.value === value}
          tabIndex={o.value === value || (i === 0 && !opts.some((x) => x.value === value)) ? 0 : -1}
          onClick={() => pick(o.value)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};
