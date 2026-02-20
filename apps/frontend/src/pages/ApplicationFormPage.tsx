import React from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { verifyApplicationFormAccess } from "../api/application-forms";
import { MultiStepForm } from "../components/multistep-form/MultiStepForm";

export const ApplicationFormPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const applicationFormId = searchParams.get("applicationFormId") ?? "";
  const leadId = searchParams.get("leadId") ?? "";

  const [code, setCode] = React.useState("");
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!applicationFormId || !leadId) {
      setError("Brakuje wymaganych parametrów linku.");
      return;
    }

    const sanitizedCode = code.replace(/[^0-9]/g, "").slice(-4);
    if (sanitizedCode.length !== 4) {
      setError("Kod musi składać się z 4 cyfr.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await verifyApplicationFormAccess({
        applicationFormId,
        leadId,
        code: sanitizedCode,
      });
      setIsUnlocked(true);
    } catch (err) {
      if (err instanceof ApiError) {
        const codeFromApi =
          typeof err.data === "object" && err.data && "code" in err.data
            ? String((err.data as { code?: string }).code)
            : null;

        if (err.status === 429 || codeFromApi === "TOO_MANY_ATTEMPTS") {
          setError("Zbyt wiele prób. Spróbuj ponownie za kilkanaście minut.");
        } else if (codeFromApi === "LINK_EXPIRED") {
          setError("Link wygasł. Skontaktuj się z doradcą, aby otrzymać nowy.");
        } else {
          setError("Nieprawidłowy kod dostępu.");
        }
      } else {
        setError("Nie udało się zweryfikować kodu. Spróbuj ponownie.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Wniosek o finansowanie</h1>
        <p style={styles.subtitle}>
          Wypełnij poniższy formularz, aby złożyć wniosek. Możesz zapisać postęp i wrócić w dowolnym momencie.
        </p>
      </header>
      <main style={styles.main}>
        {!isUnlocked ? (
          <form onSubmit={handleVerify} style={styles.gateForm}>
            <h2 style={{ marginTop: 0 }}>Wpisz 4 ostatnie cyfry telefonu</h2>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
              style={styles.gateInput}
              placeholder="np. 2502"
            />
            {error ? <p style={styles.error}>{error}</p> : null}
            <button type="submit" disabled={isLoading} style={styles.button}>
              {isLoading ? "Sprawdzam..." : "Odblokuj formularz"}
            </button>
          </form>
        ) : (
          <MultiStepForm />
        )}
      </main>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    background: "#f1f5f9",
    minHeight: "100vh",
    padding: "2rem",
  },
  header: {
    maxWidth: "800px",
    margin: "0 auto 2rem auto",
    textAlign: "center",
  },
  title: {
    fontSize: "2.25rem",
    fontWeight: 700,
    color: "#1e293b",
  },
  subtitle: {
    fontSize: "1.125rem",
    color: "#475569",
  },
  main: {
    maxWidth: "800px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "1rem",
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    padding: "2rem",
  },
  gateForm: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    maxWidth: "420px",
    margin: "0 auto",
  },
  gateInput: {
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    border: "1px solid #cbd5e1",
    fontSize: "1.125rem",
    letterSpacing: "0.2rem",
    textAlign: "center",
  },
  button: {
    padding: "0.75rem 1rem",
    borderRadius: "0.5rem",
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 600,
    cursor: "pointer",
  },
  error: {
    color: "#b91c1c",
    margin: 0,
  },
};
