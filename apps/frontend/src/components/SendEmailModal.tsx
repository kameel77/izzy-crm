import React, { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { sendLeadEmail } from "../api/leads";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../providers/ToastProvider";
import { Modal } from "./Modal";

interface ReplyContext {
  noteId?: string;
  subject?: string;
  quotedHtml?: string;
  quotedText?: string;
  defaultMessage?: string;
}

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  onSuccess: () => void;
  replyContext?: ReplyContext | null;
}

export const SendEmailModal: React.FC<SendEmailModalProps> = ({
  isOpen,
  onClose,
  leadId,
  onSuccess,
  replyContext,
}) => {
  const { token } = useAuth();
  const { addToast } = useToasts();
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState<string[]>([""]);
  const [subject, setSubject] = useState("Information from Izzy CRM");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSubject(replyContext?.subject ?? "Information from Izzy CRM");
    setMessage(replyContext?.defaultMessage ?? "");
    setLinks([""]);
  }, [isOpen, replyContext]);

  const handleLinkChange = (index: number, value: string) => {
    const newLinks = [...links];
    newLinks[index] = value;
    setLinks(newLinks);
  };

  const addLinkField = () => {
    setLinks([...links, ""]);
  };

  const removeLinkField = (index: number) => {
    const newLinks = links.filter((_, i) => i !== index);
    setLinks(newLinks);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const validLinks = links.filter((link) => link.trim() !== "");

    setIsSending(true);
    try {
      await sendLeadEmail(token, leadId, {
        message,
        links: validLinks,
        subject,
        replyToNoteId: replyContext?.noteId,
        quotedHtml: replyContext?.quotedHtml,
        quotedText: replyContext?.quotedText,
      });
      addToast("Email sent successfully", "success");
      setMessage("");
      setLinks([""]);
      setSubject("Information from Izzy CRM");
      onSuccess();
      onClose();
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "Failed to send email";
      addToast(msg, "error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Wyślij wiadomość do klienta">
      <form onSubmit={handleSubmit} style={styles.form}>
        {replyContext?.noteId ? (
          <div style={styles.replyBanner}>
            Odpowiadasz na poprzednią wiadomość – historia rozmowy zostanie dołączona automatycznie.
          </div>
        ) : null}

        <label style={styles.label}>
          Temat
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={styles.input}
            required
          />
        </label>

        <label style={styles.label}>
          Wiadomość
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={styles.textarea}
            required
            rows={6}
            placeholder="Wpisz swoją wiadomość tutaj..."
          />
        </label>

        <div style={styles.linksSection}>
          <label style={styles.label}>Linki do ofert</label>
          {links.map((link, index) => (
            <div key={index} style={styles.linkRow}>
              <input
                type="url"
                value={link}
                onChange={(e) => handleLinkChange(index, e.target.value)}
                style={styles.input}
                placeholder="https://..."
              />
              {links.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLinkField(index)}
                  style={styles.removeButton}
                  aria-label="Remove link"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addLinkField} style={styles.addButton}>
            + Dodaj kolejny link
          </button>
        </div>

        {replyContext?.quotedHtml ? (
          <div style={styles.previewContainer}>
            <div style={styles.previewLabel}>Podgląd cytowanej historii</div>
            <div
              style={styles.previewContent}
              dangerouslySetInnerHTML={{ __html: replyContext.quotedHtml }}
            />
          </div>
        ) : null}

        <div style={styles.actions}>
          <button type="button" onClick={onClose} style={styles.secondaryButton}>
            Anuluj
          </button>
          <button type="submit" disabled={isSending} style={styles.primaryButton}>
            {isSending ? "Wysyłanie..." : "Wyślij wiadomość"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const styles = {
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.5rem",
  },
  label: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
    fontWeight: 500,
    fontSize: "0.875rem",
    color: "#374151",
  },
  textarea: {
    padding: "0.75rem",
    borderRadius: "0.375rem",
    border: "1px solid #d1d5db",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    resize: "vertical" as const,
  },
  input: {
    flex: 1,
    padding: "0.75rem",
    borderRadius: "0.375rem",
    border: "1px solid #d1d5db",
    fontSize: "0.875rem",
  },
  linksSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
  },
  linkRow: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
  },
  removeButton: {
    background: "none",
    border: "none",
    color: "#ef4444",
    fontSize: "1.25rem",
    cursor: "pointer",
    padding: "0 0.5rem",
  },
  addButton: {
    alignSelf: "flex-start",
    background: "none",
    border: "none",
    color: "#2563eb",
    fontSize: "0.875rem",
    cursor: "pointer",
    padding: 0,
    fontWeight: 500,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    marginTop: "1rem",
  },
  primaryButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "0.375rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "white",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "0.375rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  replyBanner: {
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    borderRadius: "0.5rem",
    padding: "0.75rem",
    fontSize: "0.85rem",
  },
  previewContainer: {
    border: "1px solid #e5e7eb",
    borderRadius: "0.5rem",
    padding: "0.75rem",
    background: "#fafafa",
  },
  previewLabel: {
    fontSize: "0.75rem",
    color: "#6b7280",
    marginBottom: "0.5rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  previewContent: {
    maxHeight: "200px",
    overflowY: "auto" as const,
    fontSize: "0.85rem",
    color: "#374151",
  },
};
