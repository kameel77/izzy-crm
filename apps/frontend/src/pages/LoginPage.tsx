import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import { ApiError } from "../api/client";
import { Button, TextField } from "../components/ui";
import { useAuth } from "../hooks/useAuth";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("operator@example.com");
  const [password, setPassword] = useState("Operator123!");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      const redirectTo = "/dashboard";
      navigate(redirectTo, { replace: true });
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
        <h1 className="app-auth__title">Izzy CRM</h1>
        <p className="app-auth__desc">Sign in to continue</p>
        <form onSubmit={handleSubmit} className="app-form">
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? <div className="app-alert app-alert--danger">{error}</div> : null}
          <Button type="submit" variant="primary" size="lg" className="app-adm-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <Link to="/reset-password" className="app-link app-adm-auth-link">
          Zresetuj hasło
        </Link>
      </div>
    </div>
  );
};
