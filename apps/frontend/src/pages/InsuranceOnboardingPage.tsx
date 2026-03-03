import React from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../api/client";

type VerifyResponse = {
    sessionId: string;
    leadId: string;
    status: string;
    firstName: string | null;
    daysAhead: number;
};

type ConsentTemplateDto = {
    id: string;
    title: string;
    content: string;
    helpText?: string | null;
    isRequired: boolean;
    version: number;
};

type Step = "loading" | "error" | "calendar" | "consents" | "success";

const API_BASE = API_BASE_URL;

const fetchJson = async (url: string, options?: RequestInit) => {
    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options?.headers ?? {}),
        },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Unknown error" }));
        throw Object.assign(new Error(body.message ?? res.statusText), { status: res.status, body });
    }
    return res.json();
};

// ── Calendar helpers ──────────────────────────────────────────────────────────

const SLOTS = ["9:00-10:00", "10:00-11:00", "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00", "17:00-18:00"];

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

const buildAvailableDays = (daysAhead: number): Date[] => {
    const days: Date[] = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() + 1); // start tomorrow
    while (days.length < daysAhead) {
        if (!isWeekend(cursor)) {
            days.push(new Date(cursor));
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
};

const formatDatePL = (d: Date) =>
    d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });

// ── Main component ────────────────────────────────────────────────────────────

export const InsuranceOnboardingPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token") ?? "";

    const [step, setStep] = React.useState<Step>("loading");
    const [errorMsg, setErrorMsg] = React.useState("");
    const [session, setSession] = React.useState<VerifyResponse | null>(null);
    const [availableDays, setAvailableDays] = React.useState<Date[]>([]);

    // Calendar state
    const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
    const [submittingSlot, setSubmittingSlot] = React.useState(false);

    // Consent state
    const [consentTemplates, setConsentTemplates] = React.useState<ConsentTemplateDto[]>([]);
    const [consentState, setConsentState] = React.useState<Record<string, boolean>>({});
    const [submittingConsents, setSubmittingConsents] = React.useState(false);
    const [expandedConsents, setExpandedConsents] = React.useState<Record<string, boolean>>({});

    // ── Token verification on mount ──────────────────────────────────────────
    React.useEffect(() => {
        if (!token) {
            setErrorMsg("Brak tokenu w linku. Sprawdź link otrzymany w wiadomości.");
            setStep("error");
            return;
        }

        fetchJson(`${API_BASE}/api/insurance-onboarding/verify?token=${encodeURIComponent(token)}`)
            .then((data: VerifyResponse) => {
                setSession(data);
                setAvailableDays(buildAvailableDays(data.daysAhead ?? 14));
                setStep("calendar");
            })
            .catch((err: { status?: number; message?: string }) => {
                if (err.status === 401) {
                    setErrorMsg("Link wygasł lub jest nieprawidłowy. Skontaktuj się z doradcą, aby uzyskać nowy link.");
                } else {
                    setErrorMsg("Wystąpił błąd. Spróbuj odświeżyć stronę lub skontaktuj się z nami.");
                }
                setStep("error");
            });
    }, [token]);

    // ── Load consent templates when moving to consent step ───────────────────
    const loadConsents = React.useCallback(async () => {
        try {
            const data = await fetchJson(`${API_BASE}/api/consent-templates?form_type=onboarding_insurance`);
            const templates: ConsentTemplateDto[] = data.data ?? [];
            setConsentTemplates(templates);
            const initial: Record<string, boolean> = {};
            templates.forEach((t) => {
                initial[t.id] = t.isRequired;
            });
            setConsentState(initial);
        } catch {
            setErrorMsg("Nie udało się załadować zgód. Odśwież stronę.");
            setStep("error");
        }
    }, []);

    // ── Step handlers ─────────────────────────────────────────────────────────
    const handleSlotSubmit = async () => {
        if (!selectedDay || !selectedSlot) return;
        setSubmittingSlot(true);
        try {
            await fetchJson(`${API_BASE}/api/insurance-onboarding/contact-slot`, {
                method: "POST",
                body: JSON.stringify({
                    token,
                    preferredDate: selectedDay.toISOString(),
                    preferredSlot: selectedSlot,
                }),
            });
            await loadConsents();
            setStep("consents");
        } catch (err) {
            const e = err as { status?: number };
            if (e.status === 401) {
                setErrorMsg("Twój link wygasł. Poproś o nowy link.");
                setStep("error");
            } else {
                setErrorMsg("Nie udało się zapisać terminu. Spróbuj ponownie.");
            }
        } finally {
            setSubmittingSlot(false);
        }
    };

    const allRequiredAccepted = consentTemplates.every(
        (t) => !t.isRequired || consentState[t.id],
    );

    const handleConsentsSubmit = async () => {
        if (!allRequiredAccepted) return;
        setSubmittingConsents(true);
        try {
            const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
            await fetchJson(`${API_BASE}/api/insurance-onboarding/consents`, {
                method: "POST",
                body: JSON.stringify({
                    token,
                    userAgent: ua,
                    consents: consentTemplates.map((t) => ({
                        consentTemplateId: t.id,
                        version: t.version,
                        consentGiven: Boolean(consentState[t.id]),
                        consentText: t.content,
                        acceptedAt: new Date().toISOString(),
                    })),
                }),
            });
            setStep("success");
        } catch {
            setErrorMsg("Nie udało się zapisać zgód. Spróbuj ponownie.");
        } finally {
            setSubmittingConsents(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={s.shell}>
            <div style={s.card}>
                {/* Header */}
                <div style={s.header}>
                    <img src="https://krqwvegfxnlwdhgjuflh.supabase.co/storage/v1/object/public/izzy-img-public/car-salon-logo-white.png" alt="Carsalon" style={s.logoImg} />
                    <h1 style={s.heading}>Znajdziemy Ci nowe auto</h1>
                </div>

                {step === "loading" && (
                    <div style={s.center}>
                        <div style={s.spinner} />
                        <p style={s.hint}>Weryfikujemy Twój link…</p>
                    </div>
                )}

                {step === "error" && (
                    <div style={s.errorBox}>
                        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
                        <p style={s.errorText}>{errorMsg}</p>
                    </div>
                )}

                {step === "calendar" && (
                    <>
                        <p style={s.intro}>
                            {session?.firstName ? `Cześć ${session.firstName}! ` : ""}
                            Ponieważ jesteś w trakcie procesu likwidacji szkody Twojego samochodu, przesłano nam Twoje dane, abyśmy mogli pomóc Ci znaleźć nowe auto. Wybierz termin, w którym możemy się z Tobą skontaktować.
                        </p>

                        {/* Step indicator */}
                        <StepIndicator current={1} />

                        <h2 style={s.subheading}>Wybierz dzień</h2>
                        <div style={s.calGrid}>
                            {availableDays.map((day) => {
                                const key = day.toISOString();
                                const active = selectedDay?.toISOString() === key;
                                return (
                                    <button
                                        key={key}
                                        style={{ ...s.dayBtn, ...(active ? s.dayBtnActive : {}) }}
                                        onClick={() => { setSelectedDay(day); setSelectedSlot(null); }}
                                    >
                                        <span style={s.dayName}>
                                            {day.toLocaleDateString("pl-PL", { weekday: "short" })}
                                        </span>
                                        <span style={s.dayNum}>
                                            {day.toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedDay && (
                            <>
                                <h2 style={s.subheading}>
                                    Wybierz godzinę – {formatDatePL(selectedDay)}
                                </h2>
                                <div style={s.slotGrid}>
                                    {SLOTS.map((slot) => (
                                        <button
                                            key={slot}
                                            style={{ ...s.slotBtn, ...(selectedSlot === slot ? s.slotBtnActive : {}) }}
                                            onClick={() => setSelectedSlot(slot)}
                                        >
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        <button
                            style={{
                                ...s.cta,
                                opacity: !selectedDay || !selectedSlot || submittingSlot ? 0.5 : 1,
                                cursor: !selectedDay || !selectedSlot || submittingSlot ? "not-allowed" : "pointer",
                            }}
                            disabled={!selectedDay || !selectedSlot || submittingSlot}
                            onClick={handleSlotSubmit}
                        >
                            {submittingSlot ? "Zapisuję…" : "Dalej →"}
                        </button>
                    </>
                )}

                {step === "consents" && (
                    <>
                        <StepIndicator current={2} />
                        <h2 style={s.subheading}>Wymagane zgody</h2>
                        <p style={{ ...s.hint, marginBottom: "1.5rem" }}>
                            Aby nasi doradcy mogli się z Tobą skontaktować i pomóc znaleźć nowe auto, prosimy o wyrażenie poniższych zgód.
                        </p>

                        <div style={s.consentList}>
                            {consentTemplates.map((t) => (
                                <div key={t.id} style={s.consentItem}>
                                    <label style={s.checkboxWrap}>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(consentState[t.id])}
                                            onChange={(e) =>
                                                setConsentState((prev) => ({ ...prev, [t.id]: e.target.checked }))
                                            }
                                            style={s.checkbox}
                                        />
                                    </label>
                                    <div style={s.consentBody}>
                                        <div
                                            style={s.consentHeaderWrap}
                                            onClick={() => setExpandedConsents((prev) => ({ ...prev, [t.id]: !prev[t.id] }))}
                                        >
                                            <strong style={s.consentTitle}>
                                                {t.title}
                                                {t.isRequired && <span style={s.required}> *wymagana</span>}
                                            </strong>
                                            <span style={s.chevron}>{expandedConsents[t.id] ? "▲" : "▼"}</span>
                                        </div>
                                        {expandedConsents[t.id] && (
                                            <div style={s.consentContentWrap}>
                                                <div style={s.consentContent} dangerouslySetInnerHTML={{ __html: t.content }} />
                                                {t.helpText && <p style={s.consentHelp}>{t.helpText}</p>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {errorMsg && <p style={s.errorText}>{errorMsg}</p>}

                        <button
                            style={{
                                ...s.cta,
                                opacity: !allRequiredAccepted || submittingConsents ? 0.5 : 1,
                                cursor: !allRequiredAccepted || submittingConsents ? "not-allowed" : "pointer",
                            }}
                            disabled={!allRequiredAccepted || submittingConsents}
                            onClick={handleConsentsSubmit}
                        >
                            {submittingConsents ? "Zapisuję…" : "Zatwierdź i wyślij"}
                        </button>
                    </>
                )}

                {step === "success" && (
                    <div style={s.successBox}>
                        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
                        <h2 style={{ ...s.subheading, textAlign: "center", color: "hsl(142,70%,35%)" }}>
                            Gotowe!
                        </h2>
                        <p style={{ ...s.intro, textAlign: "center" }}>
                            {selectedDay && selectedSlot
                                ? `Nasz doradca skontaktuje się z Tobą ${formatDatePL(selectedDay)} w godzinach ${selectedSlot}.`
                                : "Nasz doradca skontaktuje się z Tobą wkrótce."}
                        </p>
                        <p style={{ ...s.hint, textAlign: "center", marginTop: "0.5rem" }}>
                            Na Twój adres email wyślemy potwierdzenie.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Step indicator ───────────────────────────────────────────────────────────

const StepIndicator: React.FC<{ current: 1 | 2 }> = ({ current }) => (
    <div style={si.wrap}>
        {[
            { n: 1, label: "Termin" },
            { n: 2, label: "Zgody" },
        ].map(({ n, label }) => (
            <div key={n} style={si.item}>
                <div style={{ ...si.dot, ...(current >= n ? si.dotActive : {}) }}>{n}</div>
                <span style={{ ...si.label, ...(current >= n ? si.labelActive : {}) }}>{label}</span>
            </div>
        ))}
        <div style={si.line} />
    </div>
);

const si: Record<string, React.CSSProperties> = {
    wrap: { display: "flex", alignItems: "center", gap: "0", margin: "2.5rem 0 2rem", position: "relative" },
    item: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", flex: 1 },
    dot: {
        width: "2rem", height: "2rem", borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: "0.9rem",
        background: "hsl(215,20%,88%)", color: "hsl(215,20%,50%)",
        position: "relative", zIndex: 1,
    },
    dotActive: { background: "hsl(24,95%,53%)", color: "#fff" },
    label: { fontSize: "0.75rem", color: "hsl(215,20%,55%)", fontWeight: 500 },
    labelActive: { color: "hsl(24,95%,53%)" },
    line: {
        position: "absolute", top: "1rem", left: "25%", right: "25%",
        height: "2px", background: "hsl(215,20%,88%)", zIndex: 0,
    },
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
    shell: {
        minHeight: "100vh",
        background: "linear-gradient(135deg, hsl(213,60%,97%) 0%, hsl(20,60%,97%) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        fontFamily: '"Inter","Outfit",sans-serif',
    },
    card: {
        width: "min(680px,100%)",
        background: "#fff",
        borderRadius: "1.25rem",
        boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
        overflow: "hidden",
    },
    header: {
        background: "linear-gradient(135deg, hsl(24,95%,53%), hsl(28,95%,42%))",
        padding: "2rem 2.5rem",
        color: "#fff",
    },
    logoImg: { height: "2.5rem", marginBottom: "1.25rem", objectFit: "contain" },
    heading: { margin: 0, fontSize: "1.75rem", fontWeight: 800, lineHeight: 1.2 },
    intro: { padding: "0 2.5rem", color: "hsl(215,25%,30%)", lineHeight: 1.65, fontSize: "0.95rem", marginTop: "1.5rem" },
    subheading: { padding: "0 2.5rem", fontSize: "1.1rem", fontWeight: 700, color: "hsl(213,45%,20%)", margin: "1.5rem 0 0.75rem" },
    hint: { color: "hsl(215,20%,55%)", fontSize: "0.9rem", padding: "0 2.5rem" },
    center: { display: "flex", flexDirection: "column", alignItems: "center", padding: "3rem", gap: "1rem" },
    spinner: {
        width: "2.5rem", height: "2.5rem", borderRadius: "50%",
        border: "3px solid hsl(215,20%,90%)", borderTopColor: "hsl(24,95%,53%)",
        animation: "spin 0.8s linear infinite",
    },
    errorBox: {
        padding: "2.5rem", textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center",
    },
    errorText: { color: "hsl(0,75%,50%)", lineHeight: 1.6 },
    calGrid: {
        display: "flex", flexWrap: "wrap", gap: "0.5rem",
        padding: "0 2.5rem", marginBottom: "0.5rem",
        justifyContent: "center",
    },
    dayBtn: {
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: "0.2rem", padding: "0.6rem 0.9rem",
        border: "1.5px solid hsl(215,20%,88%)", borderRadius: "0.75rem",
        background: "#fff", cursor: "pointer", transition: "all 0.15s",
        minWidth: "5rem",
    },
    dayBtnActive: {
        borderColor: "hsl(24,95%,53%)", background: "hsl(24,95%,96%)",
        boxShadow: "0 0 0 3px hsl(24,95%,90%)",
    },
    dayName: { fontSize: "0.7rem", color: "hsl(215,20%,55%)", textTransform: "capitalize" },
    dayNum: { fontSize: "0.9rem", fontWeight: 600, color: "hsl(213,45%,20%)" },
    slotGrid: {
        display: "flex", flexWrap: "wrap", gap: "0.5rem",
        padding: "0 2.5rem", marginBottom: "0.5rem",
        justifyContent: "center",
    },
    slotBtn: {
        padding: "0.5rem 0.9rem",
        border: "1.5px solid hsl(215,20%,88%)", borderRadius: "0.625rem",
        background: "#fff", cursor: "pointer", fontSize: "0.9rem",
        fontWeight: 500, color: "hsl(213,45%,25%)", transition: "all 0.15s",
    },
    slotBtnActive: {
        borderColor: "hsl(24,95%,53%)", background: "hsl(24,95%,96%)",
        boxShadow: "0 0 0 3px hsl(24,95%,90%)",
    },
    cta: {
        display: "block", width: "calc(100% - 5rem)", margin: "1.75rem 2.5rem",
        padding: "1rem", borderRadius: "0.75rem", border: "none",
        background: "linear-gradient(135deg,hsl(24,95%,53%),hsl(28,95%,42%))",
        color: "#fff", fontSize: "1.05rem", fontWeight: 700,
        boxShadow: "0 4px 20px rgba(249,115,22,0.3)",
        transition: "transform 0.1s, box-shadow 0.1s",
    },
    consentList: {
        display: "flex", flexDirection: "column", gap: "1rem",
        padding: "0 2.5rem",
    },
    consentItem: {
        display: "flex", gap: "0.75rem", alignItems: "flex-start",
        background: "hsl(215,30%,98%)", borderRadius: "0.75rem",
        padding: "1rem", border: "1px solid hsl(215,20%,90%)",
    },
    checkboxWrap: { display: "flex", alignItems: "flex-start", paddingTop: "0.15rem", cursor: "pointer" },
    checkbox: { flexShrink: 0, width: "1.1rem", height: "1.1rem", accentColor: "hsl(24,95%,53%)", cursor: "pointer" },
    consentBody: { flex: 1 },
    consentHeaderWrap: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer", width: "100%" },
    chevron: { fontSize: "0.75rem", color: "hsl(215,20%,55%)", marginLeft: "0.5rem", marginTop: "0.2rem" },
    consentContentWrap: { marginTop: "0.75rem" },
    consentTitle: { display: "block", fontSize: "0.9rem", color: "hsl(213,45%,20%)", marginBottom: "0.15rem" },
    consentContent: { margin: 0, fontSize: "0.82rem", color: "hsl(215,20%,40%)", lineHeight: 1.5 },
    consentHelp: { margin: "0.35rem 0 0", fontSize: "0.78rem", color: "hsl(215,20%,55%)" },
    required: { color: "hsl(0,75%,55%)", fontWeight: 600, fontSize: "0.75rem" },
    successBox: {
        padding: "2.5rem", display: "flex", flexDirection: "column",
        alignItems: "center",
    },
};

export default InsuranceOnboardingPage;
