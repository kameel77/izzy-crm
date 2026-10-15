import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ApiError } from "../api/client";
import { confirmPasswordReset, requestPasswordReset } from "../api/auth";
import { Button, TextField } from "../components/ui";

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token")?.trim() ?? "";

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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

  const handleConfirmSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      await confirmPasswordReset(resetToken, newPassword.trim());
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Link resetujący wygasł lub jest nieprawidłowy.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-auth">
      <div className="app-auth__card">
        <h1 className="app-auth__title">Zresetuj hasło</h1>
        {resetToken ? (
          <>
            <p className="app-auth__desc">
              Wprowadź nowe hasło (min. 8 znaków), aby zakończyć proces resetowania.
            </p>
            <form onSubmit={handleConfirmSubmit} className="app-form">
              <TextField
                label="Nowe hasło"
                type="password"
                minLength={8}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Wpisz nowe hasło..."
              />
              {error ? <div className="app-alert app-alert--danger">{error}</div> : null}
              {success ? (
                <div className="app-alert app-alert--success">
                  Hasło zostało zaktualizowane. Możesz się teraz zalogować.
                </div>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="app-adm-full"
                disabled={isSubmitting || success}
              >
                {isSubmitting ? "Zapisywanie..." : "Potwierdź zmianę hasła"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="app-auth__desc">Podaj adres e-mail konta, a wyślemy link do resetu hasła.</p>
            <form onSubmit={handleRequestSubmit} className="app-form">
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              {error ? <div className="app-alert app-alert--danger">{error}</div> : null}
              {success ? (
                <div className="app-alert app-alert--success">
                  Jeśli konto jest aktywne, wysłaliśmy link do resetu hasła na podany adres e-mail.
                </div>
              ) : null}
              <Button type="submit" variant="primary" size="lg" className="app-adm-full" disabled={isSubmitting}>
                {isSubmitting ? "Wysyłanie..." : "Wyślij"}
              </Button>
            </form>
          </>
        )}
        <Link to="/login" className="app-link app-adm-auth-link">
          Powrót do logowania
        </Link>
      </div>
    </div>
  );
};
