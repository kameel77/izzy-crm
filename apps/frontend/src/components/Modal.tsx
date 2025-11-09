import React from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  width?: string | number;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, width = "min(960px, 92%)", children }) => {
  const portalContainerRef = React.useRef<HTMLDivElement | null>(null);

  if (typeof document !== "undefined" && !portalContainerRef.current) {
    portalContainerRef.current = document.createElement("div");
    portalContainerRef.current.className = "modal-portal";
  }

  React.useEffect(() => {
    const container = portalContainerRef.current;
    if (!container || typeof document === "undefined") {
      return;
    }
    document.body.appendChild(container);
    return () => {
      document.body.removeChild(container);
    };
  }, []);

  React.useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined" || !portalContainerRef.current) {
    return null;
  }

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      style={styles.backdrop}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        style={{
          ...styles.panel,
          width,
        }}
      >
        <header style={styles.header}>
          {title ? <h2 style={styles.title}>{title}</h2> : null}
          <button type="button" onClick={onClose} style={styles.close} aria-label="Close dialog">
            ×
          </button>
        </header>
        <div style={styles.content}>{children}</div>
      </div>
    </div>,
    portalContainerRef.current,
  );
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    display: "grid",
    placeItems: "center",
    background: "rgba(15, 23, 42, 0.55)",
    padding: "2rem",
    zIndex: 80,
  },
  panel: {
    background: "#ffffff",
    borderRadius: "1rem",
    boxShadow: "0 32px 48px rgba(15, 23, 42, 0.35)",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    fontFamily: "var(--font-family-sans)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.2rem 1.5rem",
    borderBottom: "1px solid #e2e8f0",
    gap: "1rem",
  },
  title: {
    margin: 0,
    fontSize: "1.4rem",
  },
  close: {
    border: "1px solid #cbd5f5",
    background: "#f8fafc",
    borderRadius: "50%",
    width: "36px",
    height: "36px",
    cursor: "pointer",
    fontSize: "1.5rem",
    lineHeight: 1,
    display: "grid",
    placeItems: "center",
  },
  content: {
    padding: "1.5rem",
    overflowY: "auto",
  },
};
