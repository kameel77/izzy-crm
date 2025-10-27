import React, { useEffect, useState } from "react";

import { CreateUserPayload, UpdateUserPayload, UserSummary } from "../api/users";

interface UserFormProps {
  mode: "create" | "edit";
  user?: UserSummary | null;
  onSubmit: (payload: CreateUserPayload | UpdateUserPayload) => Promise<void>;
  onResetPassword?: (userId: string, password: string) => Promise<void>;
}

const ROLE_OPTIONS = [
  "PARTNER",
  "PARTNER_MANAGER",
  "PARTNER_EMPLOYEE",
  "OPERATOR",
  "SUPERVISOR",
  "ADMIN",
  "AUDITOR",
];
const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "INVITED"];

export const UserForm: React.FC<UserFormProps> = ({ mode, user, onSubmit, onResetPassword }) => {
  const [email, setEmail] = useState(user?.email ?? "");
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [role, setRole] = useState(user?.role ?? "OPERATOR");
  const [status, setStatus] = useState(user?.status ?? "INVITED");
  const [partnerId, setPartnerId] = useState(user?.partner?.id ?? "");
  const [password, setPassword] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setFullName(user.fullName);
      setPhone(user.phone ?? "");
      setRole(user.role);
      setStatus(user.status);
      setPartnerId(user.partner?.id ?? "");
    }
  }, [user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "create") {
        await onSubmit({
          email,
          fullName,
          phone: phone || undefined,
          role,
          status,
          partnerId: partnerId || undefined,
          password: password || undefined,
        });
      } else if (user) {
        await onSubmit({
          id: user.id,
          fullName,
          phone: phone || null,
          role,
          status,
          partnerId: partnerId || null,
          password: password || undefined,
        });
      }
      setSuccess(mode === "create" ? "User created" : "User updated");
      if (mode === "create") {
        setEmail("");
        setFullName("");
        setPhone("");
        setRole("OPERATOR");
        setStatus("INVITED");
        setPartnerId("");
        setPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !onResetPassword) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await onResetPassword(user.id, resetPasswordValue);
      setSuccess("Password reset");
      setResetPasswordValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section style={styles.container}>
      <h2 style={styles.title}>{mode === "create" ? "Invite/Create User" : "Edit User"}</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        {mode === "create" ? (
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
        ) : null}
        <label style={styles.label}>
          Full name
          <input
            style={styles.input}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </label>
        <label style={styles.label}>
          Phone
          <input
            style={styles.input}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label style={styles.label}>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value)} style={styles.input}>
            {ROLE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.label}>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)} style={styles.input}>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label style={styles.label}>
          Partner ID (optional)
          <input
            style={styles.input}
            value={partnerId}
            onChange={(event) => setPartnerId(event.target.value)}
            placeholder="seed-partner"
          />
        </label>
        <label style={styles.label}>
          Password {mode === "create" ? "(optional)" : "(leave blank to keep current)"}
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <div style={styles.error}>{error}</div> : null}
        {success ? <div style={styles.success}>{success}</div> : null}
        <button type="submit" style={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : mode === "create" ? "Create User" : "Save Changes"}
        </button>
      </form>

      {mode === "edit" && user && onResetPassword ? (
        <form onSubmit={handleResetPassword} style={styles.form}>
          <h3 style={styles.subtitle}>Reset Password</h3>
          <label style={styles.label}>
            New password
            <input
              style={styles.input}
              type="password"
              value={resetPasswordValue}
              onChange={(event) => setResetPasswordValue(event.target.value)}
              required
            />
          </label>
          <button type="submit" style={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      ) : null}
    </section>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  title: {
    margin: 0,
  },
  subtitle: {
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },
  input: {
    padding: "0.5rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
  },
  submit: {
    alignSelf: "flex-start",
    padding: "0.6rem 1.2rem",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
  error: {
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "0.5rem",
    borderRadius: 8,
  },
  success: {
    background: "#ecfdf5",
    color: "#047857",
    padding: "0.5rem",
    borderRadius: 8,
  },
};
