import React from "react";
import { apiFetch, ApiError } from "../api/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type OnboardingStatus =
    | "CREATED"
    | "ONBOARDING_SENT"
    | "LINK_OPENED"
    | "SLOT_SELECTED"
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
    CONSENTS_CAPTURED: "Zgody zebrane",
    COMPLETED: "Zakończony",
};

const STATUS_COLORS: Record<OnboardingStatus, React.CSSProperties> = {
    CREATED: { background: "hsl(215,30%,95%)", color: "hsl(215,30%,40%)" },
    ONBOARDING_SENT: { background: "hsl(200,80%,93%)", color: "hsl(200,80%,30%)" },
    LINK_OPENED: { background: "hsl(240,70%,93%)", color: "hsl(240,60%,40%)" },
    SLOT_SELECTED: { background: "hsl(40,90%,92%)", color: "hsl(40,90%,30%)" },
    CONSENTS_CAPTURED: { background: "hsl(142,65%,90%)", color: "hsl(142,60%,25%)" },
    COMPLETED: { background: "hsl(142,65%,90%)", color: "hsl(142,60%,25%)" },
};

const StatusBadge: React.FC<{ status: OnboardingStatus }> = ({ status }) => (
    <span
        style={{
            display: "inline-block",
            padding: "0.25em 0.7em",
            borderRadius: "1rem",
            fontSize: "0.78rem",
            fontWeight: 600,
            ...STATUS_COLORS[status],
        }}
    >
        {STATUS_LABELS[status] ?? status}
    </span>
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
            <div style={s.box}>
                <div style={s.row}>
                    <span style={s.title}>🔗 Insurance Onboarding</span>
                    <span style={s.hint}>Ładowanie…</span>
                </div>
            </div>
        );
    }

    return (
        <div style={s.box}>
            <div style={s.row}>
                <span style={s.title}>🔗 Insurance Onboarding</span>
                <div style={s.actions}>
                    {session && <StatusBadge status={session.status} />}
                    <button
                        style={{ ...s.btn, ...(sending ? s.btnDisabled : {}) }}
                        onClick={handleSend}
                        disabled={sending}
                    >
                        {sending
                            ? "Wysyłam…"
                            : session
                                ? "↺ Wyślij ponownie"
                                : "📤 Wyślij onboarding"}
                    </button>
                </div>
            </div>

            {success && <p style={s.successMsg}>{success}</p>}
            {error && <p style={s.errorMsg}>{error}</p>}

            {session && (
                <div style={s.details}>
                    {/* Timeline */}
                    <div style={s.timeline}>
                        <TimelineItem
                            icon="📤"
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
                            icon="👁"
                            label="Link otwarty"
                            date={session.openedAt}
                            sub={session.openedAt ? <span>Link ✓</span> : undefined}
                        />
                        <TimelineItem
                            icon="📅"
                            label="Termin wybrany"
                            date={session.slotSelectedAt}
                            sub={session.slotSelectedAt ? <span>Termin ✓</span> : undefined}
                            badge={session.slotSelectedAt ? "Termin wybrany" : undefined}
                        />
                        <TimelineItem
                            icon="✅"
                            label="Zgody zebrane"
                            date={session.consentsCapAt}
                            sub={session.consentsCapAt ? <span>Zgody ✓</span> : undefined}
                        />
                    </div>

                    {session.contactSchedule && (
                        <div style={s.slotHighlight}>
                            <span style={s.slotIcon}>📞</span>
                            <div>
                                <div style={s.slotLabel}>Preferowany termin kontaktu</div>
                                <div style={s.slotValue}>
                                    {fmtSlotDate(session.contactSchedule.preferredDate)},{" "}
                                    <strong>{session.contactSchedule.preferredSlot}</strong>
                                </div>
                            </div>
                        </div>
                    )}

                    <p style={s.expiry}>
                        Link wygasa: {fmtDate(session.tokenExpiresAt)} · Wysłano:{" "}
                        {fmtDate(session.createdAt)}
                    </p>
                </div>
            )}
        </div>
    );
};

const TimelineItem: React.FC<{
    icon: string;
    label: string;
    date: string | null | undefined;
    sub?: React.ReactNode;
    badge?: string;
}> = ({ icon, label, date, sub, badge }) => (
    <div style={ti.row}>
        <div style={{ ...ti.dot, ...(date ? ti.dotDone : {}) }}>{date ? icon : "○"}</div>
        <div style={ti.content}>
            <span style={{ ...ti.label, ...(date ? ti.labelDone : {}) }}>{label}</span>
            {date && <span style={ti.date}>{fmtDate(date)}</span>}
            {sub && <span style={ti.sub}>{sub}</span>}
            {badge && <span style={ti.badge}>{badge}</span>}
        </div>
    </div>
);

const ti: Record<string, React.CSSProperties> = {
    row: { display: "flex", gap: "0.75rem", alignItems: "center", padding: "0.3rem 0", justifyContent: "center", textAlign: "center", flexDirection: "column" },
    dot: { width: "1.75rem", height: "1.75rem", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", background: "hsl(215,20%,92%)", color: "hsl(215,20%,55%)", flexShrink: 0, marginTop: "0.1rem" },
    dotDone: { background: "hsl(142,65%,90%)", color: "hsl(142,60%,30%)" },
    content: { display: "flex", flexDirection: "column", gap: "0.1rem", alignItems: "center" },
    label: { fontSize: "0.85rem", color: "hsl(215,20%,55%)", fontWeight: 500 },
    labelDone: { color: "hsl(213,45%,20%)" },
    date: { fontSize: "0.8rem", color: "hsl(215,20%,55%)" },
    sub: { fontSize: "0.8rem", color: "hsl(142,60%,35%)", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.2rem" },
    badge: { fontSize: "0.75rem", color: "hsl(40,90%,35%)", background: "hsl(40,90%,90%)", padding: "0.2rem 0.6rem", borderRadius: "1rem", fontWeight: 600, marginTop: "0.2rem" },
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
    box: {
        border: "1px solid hsl(215,20%,88%)",
        borderRadius: "0.875rem",
        padding: "1.25rem",
        background: "hsl(215,30%,99%)",
        marginBottom: "1rem",
    },
    row: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "0.75rem",
        marginBottom: "0.75rem",
    },
    title: { fontWeight: 700, fontSize: "0.95rem", color: "hsl(213,45%,20%)" },
    actions: { display: "flex", alignItems: "center", gap: "0.5rem" },
    btn: {
        padding: "0.45rem 1rem",
        border: "none",
        borderRadius: "0.5rem",
        background: "linear-gradient(135deg,hsl(24,95%,53%),hsl(28,95%,42%))",
        color: "#fff",
        fontWeight: 600,
        fontSize: "0.82rem",
        cursor: "pointer",
        boxShadow: "0 2px 10px rgba(249,115,22,0.25)",
        transition: "opacity 0.15s",
    },
    btnDisabled: { opacity: 0.6, cursor: "not-allowed" },
    hint: { color: "hsl(215,20%,55%)", fontSize: "0.85rem" },
    successMsg: { color: "hsl(142,60%,30%)", fontSize: "0.85rem", margin: "0.25rem 0" },
    errorMsg: { color: "hsl(0,75%,50%)", fontSize: "0.85rem", margin: "0.25rem 0" },
    details: { marginTop: "1rem", display: "flex", flexDirection: "column", alignItems: "center" },
    timeline: { display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: "1.5rem", marginBottom: "1.5rem" },
    slotHighlight: {
        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem",
        background: "hsl(24,95%,96%)", border: "1px solid hsl(24,95%,88%)",
        borderRadius: "0.625rem", padding: "0.75rem 1rem", marginBottom: "0.75rem",
    },
    slotIcon: { fontSize: "1.4rem" },
    slotLabel: { fontSize: "0.75rem", color: "hsl(24,80%,40%)", fontWeight: 600, marginBottom: "0.2rem", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center" },
    slotValue: { fontSize: "0.92rem", color: "hsl(213,45%,20%)", textAlign: "center" },
    expiry: { fontSize: "0.75rem", color: "hsl(215,20%,60%)", margin: "0.5rem 0 0", textAlign: "center" },
};

export default LeadInsuranceOnboarding;
