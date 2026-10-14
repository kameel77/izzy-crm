import React from "react";
import { apiFetch, ApiError } from "../api/client";
import { Badge, Button, Card, Icon } from "./ui";
import type { IconName, Tone } from "./ui";

// ── Types ─────────────────────────────────────────────────────────────────────

type OnboardingStatus =
    | "CREATED"
    | "ONBOARDING_SENT"
    | "LINK_OPENED"
    | "SLOT_SELECTED"
    | "ONBOARDING_CONFIRMED"
    | "CONSENTS_CAPTURED"
    | "COMPLETED";

type ContactSchedule = {
    preferredDate: string;
    preferredSlot: string;
    timezone: string;
};

type OnboardingSession = {
    id: string;
    status: OnboardingStatus;
    smsSentAt: string | null;
    emailSentAt: string | null;
    openedAt: string | null;
    slotSelectedAt: string | null;
    consentsCapAt: string | null;
    tokenExpiresAt: string;
    createdAt: string;
    updatedAt: string;
    contactSchedule: ContactSchedule | null;
};

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OnboardingStatus, string> = {
    CREATED: "Oczekuje",
    ONBOARDING_SENT: "Link wysłany",
    LINK_OPENED: "Link otwarty",
    SLOT_SELECTED: "Termin wybrany",
    ONBOARDING_CONFIRMED: "Onboarding confirmed",
    CONSENTS_CAPTURED: "Zgody zebrane",
    COMPLETED: "Zakończony",
};

const STATUS_TONES: Record<OnboardingStatus, Tone> = {
    CREATED: "neutral",
    ONBOARDING_SENT: "info",
    LINK_OPENED: "accent",
    SLOT_SELECTED: "warning",
    ONBOARDING_CONFIRMED: "success",
    CONSENTS_CAPTURED: "success",
    COMPLETED: "success",
};

const StatusBadge: React.FC<{ status: OnboardingStatus }> = ({ status }) => (
    <Badge tone={STATUS_TONES[status] ?? "neutral"}>{STATUS_LABELS[status] ?? status}</Badge>
);

// ── Format helpers ─────────────────────────────────────────────────────────────

const fmtDate = (iso: string | null) => {
    if (!iso) return "–";
    return new Date(iso).toLocaleString("pl-PL", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const fmtSlotDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
};

// ── Main component ────────────────────────────────────────────────────────────

export const LeadInsuranceOnboarding: React.FC<{ leadId: string }> = ({ leadId }) => {
    const [session, setSession] = React.useState<OnboardingSession | null | undefined>(undefined);
    const [loading, setLoading] = React.useState(true);
    const [sending, setSending] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState<string | null>(null);

    const fetchStatus = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiFetch<{ data: OnboardingSession | null }>(
                `/api/leads/${leadId}/insurance-onboarding`,
            );
            setSession(res.data ?? null);
        } catch {
            setSession(null);
        } finally {
            setLoading(false);
        }
    }, [leadId]);

    React.useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleSend = async () => {
        if (!confirm("Czy na pewno chcesz wysłać onboarding insurance do tego leada? Zostanie wysłany SMS i email.")) return;
        setSending(true);
        setError(null);
        setSuccess(null);
        try {
            await apiFetch(`/api/leads/${leadId}/insurance-onboarding/start`, { method: "POST" });
            setSuccess("Onboarding wysłany!");
            await fetchStatus();
        } catch (err) {
            const msg =
                err instanceof ApiError
                    ? err.message
                    : "Błąd podczas wysyłania. Spróbuj ponownie.";
            setError(msg);
        } finally {
            setSending(false);
        }
    };

    if (loading && session === undefined) {
        return (
            <Card title="Insurance onboarding" icon="shield">
                <span className="app-muted">Ładowanie…</span>
            </Card>
        );
    }

    return (
        <Card
            title="Insurance onboarding"
            icon="shield"
            actions={
                <div className="app-lead-ins-actions">
                    {session && <StatusBadge status={session.status} />}
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={session ? "refresh" : "mail"}
                        onClick={handleSend}
                        disabled={sending}
                    >
                        {sending ? "Wysyłam…" : session ? "Wyślij ponownie" : "Wyślij onboarding"}
                    </Button>
                </div>
            }
        >
            <div className="app-lead-ins-body">
            {success && <div className="app-alert app-alert--success">{success}</div>}
            {error && <div className="app-alert app-alert--danger">{error}</div>}

            {session && (
                <div className="app-lead-ins-details">
                    {/* Timeline */}
                    <div className="app-lead-ins-timeline">
                        <TimelineItem
                            icon="mail"
                            label="Link wysłany"
                            date={session.smsSentAt ?? session.emailSentAt}
                            sub={
                                [
                                    session.smsSentAt ? <span key="sms">SMS ✓</span> : null,
                                    session.emailSentAt ? <span key="email">Email ✓</span> : null,
                                ]
                                    .filter(Boolean)
                            }
                        />
                        <TimelineItem
                            icon="arrow-up-right"
                            label="Link otwarty"
                            date={session.openedAt}
                            sub={session.openedAt ? <span>Link ✓</span> : undefined}
                        />
                        <TimelineItem
                            icon="calendar"
                            label="Termin potwierdzony"
                            date={session.slotSelectedAt}
                            sub={session.slotSelectedAt ? <span>Termin ✓</span> : undefined}
                        />
                        <TimelineItem
                            icon="check"
                            label="Zgody zebrane"
                            date={session.consentsCapAt}
                            sub={session.consentsCapAt ? <span>Zgody ✓</span> : undefined}
                        />
                    </div>

                    {session.contactSchedule && (
                        <div className="app-lead-ins-slot">
                            <Icon name="clock" size={20} />
                            <div>
                                <div className="app-lead-ins-slot__label">Preferowany termin kontaktu</div>
                                <div className="app-lead-ins-slot__value">
                                    {fmtSlotDate(session.contactSchedule.preferredDate)},{" "}
                                    <strong>{session.contactSchedule.preferredSlot}</strong>
                                </div>
                            </div>
                        </div>
                    )}

                    <p className="app-lead-ins-expiry">
                        Link wygasa: {fmtDate(session.tokenExpiresAt)} · Wysłano:{" "}
                        {fmtDate(session.createdAt)}
                    </p>
                </div>
            )}
            </div>
        </Card>
    );
};

const TimelineItem: React.FC<{
    icon: IconName;
    label: string;
    date: string | null | undefined;
    sub?: React.ReactNode;
    badge?: string;
}> = ({ icon, label, date, sub, badge }) => (
    <div className="app-lead-ins-step">
        <div className={`app-lead-ins-step__dot${date ? " app-lead-ins-step__dot--done" : ""}`}>
            {date ? <Icon name={icon} size={14} /> : "○"}
        </div>
        <div className="app-lead-ins-step__content">
            <span className={`app-lead-ins-step__label${date ? " app-lead-ins-step__label--done" : ""}`}>{label}</span>
            {date && <span className="app-lead-ins-step__date">{fmtDate(date)}</span>}
            {sub && <span className="app-lead-ins-step__sub">{sub}</span>}
            {badge && <Badge tone="warning">{badge}</Badge>}
        </div>
    </div>
);

export default LeadInsuranceOnboarding;
