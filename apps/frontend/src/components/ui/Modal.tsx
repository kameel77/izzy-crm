import React from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { cx } from "./cx";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** aria-label used when no title is rendered. */
  ariaLabel?: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
  width?: string | number;
  /** Close on mousedown on the overlay (default true). */
  closeOnOverlay?: boolean;
  /** Close on Escape when this is the top-most open modal (default true). */
  closeOnEscape?: boolean;
  children?: React.ReactNode;
}

// Open modals, innermost last — Escape closes only the top one.
const openStack: string[] = [];
let lockedOverflow = "";

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  ariaLabel,
  description,
  footer,
  size,
  width,
  closeOnOverlay = true,
  closeOnEscape = true,
  children,
}) => {
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    // Body scroll is locked while any modal is open, so closing several at once restores it.
    if (openStack.length === 0) {
      lockedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openStack.push(titleId);
    return () => {
      openStack.splice(openStack.lastIndexOf(titleId), 1);
      if (openStack.length === 0) document.body.style.overflow = lockedOverflow;
    };
  }, [open, titleId]);

  React.useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openStack[openStack.length - 1] === titleId) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, titleId, closeOnEscape]);

  if (!open) return null;

  return createPortal(
    <div
      className="iz-modal-overlay"
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cx("iz-modal", size === "lg" && "iz-modal--lg")}
        style={width != null ? { maxWidth: width } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
      >
        <div className="iz-modal__head">
          <div>
            {title ? (
              <h2 className="iz-modal__title" id={titleId}>
                {title}
              </h2>
            ) : null}
            {description ? <p className="iz-modal__desc">{description}</p> : null}
          </div>
          <Button variant="ghost" size="sm" icon="x" className="iz-modal__close" aria-label="Close" onClick={onClose} />
        </div>
        <div className="iz-modal__body">{children}</div>
        {footer ? <div className="iz-modal__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
};
