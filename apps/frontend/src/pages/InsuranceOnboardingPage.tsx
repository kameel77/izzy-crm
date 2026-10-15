import React from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../api/client";
import { Button, Checkbox, Icon } from "../components/ui";
import { cx } from "../components/ui/cx";
import { useBrandTheme } from "../hooks/useBrandTheme";
import { sanitizeHtml } from "../utils/sanitizeHtml";

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

const getAvailableSlots = (date: Date): string[] => {
    const now = new Date();
    const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    if (!isToday) {
        return SLOTS;
    }

    const currentHour = now.getHours();
    return SLOTS.filter((slot) => {
        const startHour = parseInt(slot.split(":")[0], 10);
        return startHour > currentHour;
    });
};

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

const buildAvailableDays = (daysAhead: number): Date[] => {
    const days: Date[] = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    // If there are no slots available today or today is a weekend, start from tomorrow
    if (getAvailableSlots(new Date()).length === 0 || isWeekend(new Date())) {
        cursor.setDate(cursor.getDate() + 1);
    }

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
    useBrandTheme("carsalon");
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
        <div className="app-io">
            <div className="app-io__card">
                {/* Header */}
                <div className="app-io__header">
                    <img src="/brands/carsalon/logo.png" alt="CarSalon" className="app-io__logo" />
                    <h1 className="app-io__title">Znajdziemy Ci nowe auto</h1>
                </div>

                <div className="app-io__body">
                    {step === "loading" && (
                        <div className="app-io__center">
                            <Icon name="loader" size={28} className="app-io__spinner" />
                            <p className="app-muted">Weryfikujemy Twój link…</p>
                        </div>
                    )}

                    {step === "error" && (
                        <div className="app-io__center">
                            <span className="app-io__status app-io__status--danger">
                                <Icon name="alert" size={24} />
                            </span>
                            <p className="app-io__error">{errorMsg}</p>
                        </div>
                    )}

                    {step === "calendar" && (
                        <>
                            <p className="app-io__intro">
                                {session?.firstName ? `Cześć ${session.firstName}! ` : ""}
                                Ponieważ jesteś w trakcie procesu likwidacji szkody Twojego samochodu, przesłano nam Twoje dane, abyśmy mogli pomóc Ci znaleźć nowe auto. Wybierz termin, w którym możemy się z Tobą skontaktować.
                            </p>

                            {/* Step indicator */}
                            <StepIndicator current={1} />

                            <h2 className="app-io__subtitle">Wybierz dzień</h2>
                            <div className="app-io-choices">
                                {availableDays.map((day) => {
                                    const key = day.toISOString();
                                    const active = selectedDay?.toISOString() === key;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            className={cx("app-io-day", active && "app-io-day--active")}
                                            aria-pressed={active}
                                            onClick={() => { setSelectedDay(day); setSelectedSlot(null); }}
                                        >
                                            <span className="app-io-day__name">
                                                {day.toLocaleDateString("pl-PL", { weekday: "short" })}
                                            </span>
                                            <span className="app-io-day__num">
                                                {day.toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedDay && (
                                <>
                                    <h2 className="app-io__subtitle">
                                        Wybierz godzinę – {formatDatePL(selectedDay)}
                                    </h2>
                                    <div className="app-io-choices">
                                        {getAvailableSlots(selectedDay).map((slot) => (
                                            <button
                                                key={slot}
                                                type="button"
                                                className={cx("app-io-slot", selectedSlot === slot && "app-io-slot--active")}
                                                aria-pressed={selectedSlot === slot}
                                                onClick={() => setSelectedSlot(slot)}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            <Button
                                variant="primary"
                                size="lg"
                                className="app-io__cta"
                                iconRight={submittingSlot ? undefined : "chevron-right"}
                                disabled={!selectedDay || !selectedSlot || submittingSlot}
                                onClick={handleSlotSubmit}
                            >
                                {submittingSlot ? "Zapisuję…" : "Dalej"}
                            </Button>
                        </>
                    )}

                    {step === "consents" && (
                        <>
                            <StepIndicator current={2} />
                            <h2 className="app-io__subtitle">Wymagane zgody</h2>
                            <p className="app-muted app-io__lead">
                                Aby nasi doradcy mogli się z Tobą skontaktować i pomóc znaleźć nowe auto, prosimy o wyrażenie poniższych zgód.
                            </p>

                            <div className="app-io-consents">
                                {consentTemplates.map((t) => (
                                    <div key={t.id} className="app-io-consent">
                                        <Checkbox
                                            label={null}
                                            aria-label={t.title}
                                            checked={Boolean(consentState[t.id])}
                                            onChange={(e) =>
                                                setConsentState((prev) => ({ ...prev, [t.id]: e.target.checked }))
                                            }
                                        />
                                        <div className="app-io-consent__body">
                                            <button
                                                type="button"
                                                className="app-io-consent__toggle"
                                                aria-expanded={Boolean(expandedConsents[t.id])}
                                                onClick={() => setExpandedConsents((prev) => ({ ...prev, [t.id]: !prev[t.id] }))}
                                            >
                                                <strong className="app-io-consent__title">
                                                    {t.title}
                                                    {t.isRequired && <span className="app-io-consent__required"> *wymagana</span>}
                                                </strong>
                                                <Icon
                                                    name="chevron-down"
                                                    size={16}
                                                    className={cx("app-io-consent__chevron", expandedConsents[t.id] && "app-io-consent__chevron--open")}
                                                />
                                            </button>
                                            {expandedConsents[t.id] && (
                                                <div className="app-io-consent__content">
                                                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.content) }} />
                                                    {t.helpText && <p className="app-io-consent__help">{t.helpText}</p>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {errorMsg && <p className="app-alert app-alert--danger app-io__alert">{errorMsg}</p>}

                            <Button
                                variant="primary"
                                size="lg"
                                className="app-io__cta"
                                disabled={!allRequiredAccepted || submittingConsents}
                                onClick={handleConsentsSubmit}
                            >
                                {submittingConsents ? "Zapisuję…" : "Zatwierdź i wyślij"}
                            </Button>
                        </>
                    )}

                    {step === "success" && (
                        <div className="app-io__center">
                            <span className="app-io__status app-io__status--success">
                                <Icon name="check" size={24} />
                            </span>
                            <h2 className="app-io__subtitle app-io__subtitle--success">
                                Gotowe!
                            </h2>
                            <p className="app-io__intro app-io__intro--center">
                                {selectedDay && selectedSlot
                                    ? `Nasz doradca skontaktuje się z Tobą ${formatDatePL(selectedDay)} w godzinach ${selectedSlot}.`
                                    : "Nasz doradca skontaktuje się z Tobą wkrótce."}
                            </p>
                            <p className="app-muted app-io__text-center">
                                Na Twój adres email wyślemy potwierdzenie.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Step indicator ───────────────────────────────────────────────────────────

const StepIndicator: React.FC<{ current: 1 | 2 }> = ({ current }) => (
    <div className="app-io-steps">
        {[
            { n: 1, label: "Termin" },
            { n: 2, label: "Zgody" },
        ].map(({ n, label }) => (
            <div key={n} className="app-io-steps__item">
                <div className={cx("app-io-steps__dot", current >= n && "app-io-steps__dot--active")}>{n}</div>
                <span className={cx("app-io-steps__label", current >= n && "app-io-steps__label--active")}>{label}</span>
            </div>
        ))}
        <div className="app-io-steps__line" />
    </div>
);

export default InsuranceOnboardingPage;
