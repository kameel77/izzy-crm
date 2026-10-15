import React, { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { generatePersonalOfferLink } from "../utils/offerGenerator";
import { generateOfferLink, sendLeadEmail } from "../api/leads";
import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../providers/ToastProvider";
import { Modal } from "./Modal";
import { Button, TextField } from "./ui";
import { sanitizeHtml } from "../utils/sanitizeHtml";

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
  offerBudget?: number | null;
  offerAmountAvailable?: number | null;
}

export const SendEmailModal: React.FC<SendEmailModalProps> = ({
  isOpen,
  onClose,
  leadId,
  onSuccess,
  replyContext,
  offerBudget,
  offerAmountAvailable,
}) => {
  const { token, user } = useAuth();
  const { addToast } = useToasts();
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState<string[]>([""]);
  const [subject, setSubject] = useState("Information from Izzy CRM");
  const [isSending, setIsSending] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerBaseUrl, setOfferBaseUrl] = useState("");
  const [offerDiscount, setOfferDiscount] = useState("");
  const [offerError, setOfferError] = useState<string | null>(null);
  const [isGeneratingOffer, setIsGeneratingOffer] = useState(false);
  const [offerInitialPayment, setOfferInitialPayment] = useState("");
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const messageId = React.useId();


  useEffect(() => {
    if (!isOpen || !token) return;

    const loadDraft = async () => {
      setIsLoadingDraft(true);
      try {
        const { getMessageDraft } = await import("../api/leads");
        const draft = await getMessageDraft(token, leadId);
        
        if (draft) {
          setMessage(draft.body ?? replyContext?.defaultMessage ?? "");
          setSubject(draft.subject ?? replyContext?.subject ?? "Information from Izzy CRM");
          setLinks(draft.links.length > 0 ? draft.links : [""]);
        } else {
          setSubject(replyContext?.subject ?? "Information from Izzy CRM");
          setMessage(replyContext?.defaultMessage ?? "");
          setLinks([""]);
        }
      } catch (error) {
        console.error("Failed to load draft:", error);
        setSubject(replyContext?.subject ?? "Information from Izzy CRM");
        setMessage(replyContext?.defaultMessage ?? "");
        setLinks([""]);
      } finally {
        setIsLoadingDraft(false);
      }
    };

    loadDraft();
    setOfferBaseUrl("");
    setOfferDiscount("");
    setOfferInitialPayment("");
    setOfferError(null);
  }, [isOpen, replyContext, token, leadId]);

  const defaultOfferDiscount = React.useMemo(() => {
    const values = [offerBudget, offerAmountAvailable].filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value),
    );
    if (!values.length) {
      return 0;
    }
    return Math.min(...values);
  }, [offerBudget, offerAmountAvailable]);

  useEffect(() => {
    setOfferDiscount(String(Math.round(defaultOfferDiscount)));
  }, [defaultOfferDiscount]);

  useEffect(() => {
    if (!isOfferModalOpen) return;
    const firstLink = links.find((link) => link.trim().length > 0) ?? "";
    setOfferBaseUrl(firstLink);
    setOfferError(null);
  }, [isOfferModalOpen, links]);

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

      // Clear the draft after successful send
      const { saveMessageDraft } = await import("../api/leads");
      await saveMessageDraft(token, leadId, {
        message: "",
        subject: "Information from Izzy CRM",
        links: [],
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

  useEffect(() => {
    if (!token || !isOpen || isLoadingDraft) return;

    const autoSaveDraft = async () => {
      try {
        const { saveMessageDraft } = await import("../api/leads");
        await saveMessageDraft(token, leadId, {
          message,
          subject,
          links: links.filter(l => l.trim().length > 0),
        });
      } catch (error) {
        console.error("Failed to auto-save draft", error);
      }
    };

    const timeoutId = setTimeout(autoSaveDraft, 1000);
    return () => clearTimeout(timeoutId);
  }, [message, subject, links, token, leadId, isOpen, isLoadingDraft]);

  const handleGenerateOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;

    const trimmedBaseUrl = offerBaseUrl.trim();
    const discountValue = Number(offerDiscount);

    if (!trimmedBaseUrl) {
      setOfferError("Podaj adres strony z ofertą.");
      return;
    }

    if (!Number.isFinite(discountValue) || !Number.isInteger(discountValue)) {
      setOfferError("Wartość rabatu musi być liczbą całkowitą.");
      return;
    }

    setIsGeneratingOffer(true);
    setOfferError(null);
    try {
      const response = await generateOfferLink(token, leadId, {
        baseUrl: trimmedBaseUrl,
        discountPln: discountValue,
      });

      setLinks((prev) => {
        const next = [...prev];
        const emptyIndex = next.findIndex((link) => link.trim().length === 0);
        if (emptyIndex >= 0) {
          next[emptyIndex] = response.finalUrl;
        } else {
          next.push(response.finalUrl);
        }
        return next;
      });

      addToast("Oferta specjalna została wygenerowana.", "success");
      setIsOfferModalOpen(false);
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "Nie udało się wygenerować oferty.";
      setOfferError(msg);
      addToast(msg, "error");
    } finally {
      setIsGeneratingOffer(false);
    }
  };

  const handleGenerateShortlist = async (event: React.FormEvent) => {
    event.preventDefault();

    const validLinks = links.filter((link) => link.trim() !== "");
    if (validLinks.length === 0) {
      addToast("Dodaj przynajmniej jeden link z bazy, by wygenerować shortlistę.", "error");
      return;
    }

    let baseUrl = "";
    const carIds: string[] = [];

    for (const link of validLinks) {
      try {
        const url = new URL(link);
        if (!baseUrl) {
          // Extract domain as base URL
          baseUrl = url.origin;
        }

        // Process pathname to extract ID after the last hyphen
        const pathname = url.pathname.replace(/\/+$/, ''); // no trailing slashes
        const parts = pathname.split('-');
        if (parts.length > 0) {
          const id = parts[parts.length - 1];
          if (id) {
            carIds.push(id);
          }
        }
      } catch (e) {
        // Skip badly formatted
      }
    }

    if (carIds.length === 0) {
      addToast("Brak prawidłowych linków aut (np. /oferta/nazwa-auta-123).", "error");
      return;
    }

    const discountValue = Number(offerDiscount) || 0;
    const paymentValue = offerInitialPayment.trim() ? Number(offerInitialPayment) : null;

    const generatedLink = generatePersonalOfferLink(
      baseUrl,
      leadId,
      discountValue,
      paymentValue,
      carIds
    );

    setLinks([generatedLink]);
    addToast("Shortlista została pomyślnie wygenerowana", "success");
  };

  const canEditOfferDiscount = user?.role === "OPERATOR" || user?.role === "ADMIN";

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Wyślij wiadomość do klienta">
        <form onSubmit={handleSubmit} className="app-form">
          {replyContext?.noteId ? (
            <div className="app-alert app-alert--info">
              Odpowiadasz na poprzednią wiadomość – historia rozmowy zostanie dołączona automatycznie.
            </div>
          ) : null}

          <TextField
            label="Temat"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />

          <div className="iz-field">
            <label className="iz-field__label" htmlFor={messageId}>
              Wiadomość
            </label>
            <textarea
              id={messageId}
              className="app-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              placeholder="Wpisz swoją wiadomość tutaj..."
            />
          </div>

          <div className="app-lf-inline-row">
            <TextField
              label="Wartość rabatu (PLN)"
              type="number"
              min={0}
              step={1}
              value={offerDiscount}
              onChange={(event) => setOfferDiscount(event.target.value)}
            />
            <TextField
              label="Wpłata początkowa (PLN)"
              type="number"
              min={0}
              step={1}
              value={offerInitialPayment}
              onChange={(event) => setOfferInitialPayment(event.target.value)}
              placeholder="Opcjonalna"
            />
          </div>

          <div className="app-form-actions app-form-actions--start">
            <Button type="button" variant="secondary" onClick={() => setIsOfferModalOpen(true)}>
              Generuj ofertę specjalną
            </Button>
            <Button type="button" variant="secondary" onClick={handleGenerateShortlist}>
              Generuj shortlistę
            </Button>
          </div>

          <div className="app-lf-links">
            <span className="iz-field__label">Linki do ofert</span>
            {links.map((link, index) => (
              <div key={index} className="app-lf-link-row">
                <TextField
                  type="url"
                  className="app-lf-link-row__field"
                  aria-label="Link do oferty"
                  value={link}
                  onChange={(e) => handleLinkChange(index, e.target.value)}
                  placeholder="https://..."
                />
                {links.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon="x"
                    onClick={() => removeLinkField(index)}
                    aria-label="Remove link"
                  />
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" icon="plus" onClick={addLinkField} className="app-lf-links__add">
              Dodaj kolejny link
            </Button>
          </div>

          {replyContext?.quotedHtml ? (
            <div className="app-lf-preview">
              <div className="app-lf-preview__label">Podgląd cytowanej historii</div>
              <div
                className="app-lf-preview__content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(replyContext.quotedHtml) }}
              />
            </div>
          ) : null}

          <div className="app-form-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" variant="primary" disabled={isSending}>
              {isSending ? "Wysyłanie..." : "Wyślij wiadomość"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isOfferModalOpen}
        onClose={() => setIsOfferModalOpen(false)}
        title="Potwierdź wartość budżetu"
        width="min(540px, 92%)"
      >
        <form onSubmit={handleGenerateOffer} className="app-form">
          <TextField
            label="Adres oferty"
            type="url"
            value={offerBaseUrl}
            onChange={(event) => setOfferBaseUrl(event.target.value)}
            placeholder="https://twoja-domena.pl/listing/12345"
            required
          />

          <TextField
            label="Wartość budżetu (PLN)"
            type="number"
            min={0}
            step={1}
            value={offerDiscount}
            onChange={(event) => setOfferDiscount(event.target.value)}
            readOnly={!canEditOfferDiscount}
            hint={!canEditOfferDiscount ? "Tę wartość może zmienić tylko Operator lub Admin." : undefined}
          />

          {offerError ? <div className="app-alert app-alert--danger">{offerError}</div> : null}

          <div className="app-form-actions">
            <Button type="button" variant="secondary" onClick={() => setIsOfferModalOpen(false)}>
              Anuluj
            </Button>
            <Button type="submit" variant="primary" disabled={isGeneratingOffer}>
              {isGeneratingOffer ? "Generuję..." : "Dodaj link do wiadomości"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
