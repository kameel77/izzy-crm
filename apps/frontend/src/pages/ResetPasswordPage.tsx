import React, { useState } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "../api/client";
import { requestPasswordReset } from "../api/auth";

export const ResetPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unexpected error, please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Zresetuj hasło</h1>
          <p style={styles.subtitle}>Podaj adres e-mail konta, a wyślemy nowe hasło.</p>
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>
              Email
              <input
                style={styles.input}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            {error ? <div style={styles.error}>{error}</div> : null}
            {success ? (
              <div style={styles.success}>
                Jeśli konto istnieje, wysłaliśmy nowe hasło na podany adres e-mail.
              </div>
            ) : null}
            <button type="submit" style={styles.button} disabled={isSubmitting}>
              {isSubmitting ? "Wysyłanie..." : "Wyślij"}
            </button>
          </form>
          <Link to="/login" style={styles.link}>
            Powrót do logowania
          </Link>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "radial-gradient(circle at 20% 20%, #e0f2fe, transparent 35%), radial-gradient(circle at 80% 0%, #bfdbfe, transparent 30%), #eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    zIndex: 1000,
  },
  container: {
    width: "100%",
    maxWidth: 480,
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  card: {
    width: "100%",
    background: "#ffffff",
    borderRadius: 12,
    padding: "2.5rem",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
  },
  title: {
    margin: 0,
    fontSize: "1.75rem",
    color: "#1f2937",
  },
  subtitle: {
    margin: "0.5rem 0 1.5rem",
    color: "#6b7280",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    fontSize: "0.9rem",
    color: "#374151",
  },
  input: {
    padding: "0.75rem 1rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: "1rem",
  },
  button: {
    marginTop: "0.5rem",
    padding: "0.75rem 1rem",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 600,
    cursor: "pointer",
  },
  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "0.75rem",
    borderRadius: 8,
  },
  success: {
    background: "#ecfdf3",
    color: "#166534",
    padding: "0.75rem",
    borderRadius: 8,
  },
  link: {
    display: "block",
    marginTop: "1.25rem",
    color: "#2563eb",
    fontWeight: 600,
    textDecoration: "none",
    textAlign: "center",
  },
};
