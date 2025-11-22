import React, { useState } from "react";
import { ApiError } from "../api/client";
import { sendLeadEmail } from "../api/leads";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../providers/ToastProvider";
import { Modal } from "./Modal";

interface SendEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadId: string;
    onSuccess: () => void;
}

export const SendEmailModal: React.FC<SendEmailModalProps> = ({
    isOpen,
    onClose,
    leadId,
    onSuccess,
}) => {
    const { token } = useAuth();
    const { addToast } = useToasts();
    const [message, setMessage] = useState("");
    const [links, setLinks] = useState<string[]>([""]);
    const [isSending, setIsSending] = useState(false);

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
            });
            addToast("Email sent successfully", "success");
            setMessage("");
            setLinks([""]);
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
        <Modal isOpen={isOpen} onClose={onClose} title="Send Email to Client">
            <form onSubmit={handleSubmit} style={styles.form}>
                <label style={styles.label}>
                    Message
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        style={styles.textarea}
                        required
                        rows={6}
                        placeholder="Type your message here..."
                    />
                </label>

                <div style={styles.linksSection}>
                    <label style={styles.label}>Links to Offers</label>
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
                        + Add another link
                    </button>
                </div>

                <div style={styles.actions}>
                    <button type="button" onClick={onClose} style={styles.secondaryButton}>
                        Cancel
                    </button>
                    <button type="submit" disabled={isSending} style={styles.primaryButton}>
                        {isSending ? "Sending..." : "Send Email"}
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
};
