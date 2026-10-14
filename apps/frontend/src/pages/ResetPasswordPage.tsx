import React, { useState } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "../api/client";
import { requestPasswordReset } from "../api/auth";
import { Button, TextField } from "../components/ui";

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
    <div className="app-auth">
      <div className="app-auth__card">
        <h1 className="app-auth__title">Zresetuj hasło</h1>
        <p className="app-auth__desc">Podaj adres e-mail konta, a wyślemy nowe hasło.</p>
        <form onSubmit={handleSubmit} className="app-form">
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
              Jeśli konto istnieje, wysłaliśmy nowe hasło na podany adres e-mail.
            </div>
          ) : null}
          <Button type="submit" variant="primary" size="lg" className="app-adm-full" disabled={isSubmitting}>
            {isSubmitting ? "Wysyłanie..." : "Wyślij"}
          </Button>
        </form>
        <Link to="/login" className="app-link app-adm-auth-link">
          Powrót do logowania
        </Link>
      </div>
    </div>
  );
};
