import React, { useEffect, useState } from "react";

import { fetchPartners, PartnerSummary } from "../api/partners";
import { CreateUserPayload, UpdateUserPayload, UserSummary } from "../api/users";
import { useAuth } from "../hooks/useAuth";
import { Button, Select, TextField } from "./ui";

interface UserFormProps {
  mode: "create" | "edit";
  user?: UserSummary | null;
  onSubmit: (payload: CreateUserPayload | UpdateUserPayload) => Promise<void>;
  onResetPassword?: (userId: string, password: string) => Promise<void>;
  onSuccess?: () => void;
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

export const UserForm: React.FC<UserFormProps> = ({ mode, user, onSubmit, onResetPassword, onSuccess }) => {
  const { token } = useAuth();
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
  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnersError, setPartnersError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const loadPartners = async () => {
      if (!token) return;
      setPartnersLoading(true);
      setPartnersError(null);
      try {
        const response = await fetchPartners(token, { page: 1, perPage: 100 });
        if (!cancelled) {
          setPartners(
            [...response.data].sort((a, b) => a.name.localeCompare(b.name)),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setPartnersError("Failed to load partners");
        }
      } finally {
        if (!cancelled) {
          setPartnersLoading(false);
        }
      }
    };

    loadPartners();

    return () => {
      cancelled = true;
    };
  }, [token]);

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
      onSuccess?.();
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
    <section className="app-form">
      <h2 className="app-section-title">{mode === "create" ? "Invite/Create user" : "Edit user"}</h2>
      <form onSubmit={handleSubmit} className="app-form">
        {mode === "create" ? (
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        ) : null}
        <TextField
          label="Full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
        <TextField label="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <Select label="Role" value={role} onChange={(event) => setRole(event.target.value)} options={ROLE_OPTIONS} />
        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={STATUS_OPTIONS}
        />
        <Select
          label="Partner (optional)"
          value={partnerId}
          onChange={(event) => setPartnerId(event.target.value)}
          disabled={partnersLoading || Boolean(partnersError)}
          options={[
            { value: "", label: "No partner" },
            ...partners.map((partner) => ({ value: partner.id, label: partner.name })),
          ]}
          hint={partnersLoading ? "Loading partners…" : undefined}
          error={partnersError || undefined}
        />
        <TextField
          label={`Password ${mode === "create" ? "(optional)" : "(leave blank to keep current)"}`}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? <div className="app-alert app-alert--danger">{error}</div> : null}
        {success ? <div className="app-alert app-alert--success">{success}</div> : null}
        <div className="app-form-actions app-form-actions--start">
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : mode === "create" ? "Create user" : "Save changes"}
          </Button>
        </div>
      </form>

      {mode === "edit" && user && onResetPassword ? (
        <form onSubmit={handleResetPassword} className="app-form app-adm-subform">
          <h3 className="app-section-title">Reset password</h3>
          <TextField
            label="New password"
            type="password"
            value={resetPasswordValue}
            onChange={(event) => setResetPasswordValue(event.target.value)}
            required
          />
          <div className="app-form-actions app-form-actions--start">
            <Button type="submit" variant="secondary" disabled={isSubmitting}>
              {isSubmitting ? "Resetting..." : "Reset password"}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
};
