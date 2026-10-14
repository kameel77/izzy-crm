import React from "react";
import { Link } from "react-router-dom";
import { StuckForm } from "../../api/analytics";
import { Card } from "../ui";

interface StuckFormsWidgetProps {
  forms: StuckForm[];
  loading: boolean;
}

const timeAgo = (date: string) => {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " lat temu";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " mies. temu";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " dni temu";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " godz. temu";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " min. temu";
  return "przed chwilą";
};

export const StuckFormsWidget: React.FC<StuckFormsWidgetProps> = ({ forms, loading }) => (
  <Card title="Zawieszone formularze" icon="clock">
    {loading ? (
      <p className="app-empty">Ładowanie...</p>
    ) : forms.length === 0 ? (
      <p className="app-empty">Brak zawieszonych formularzy.</p>
    ) : (
      <div className="app-stuck">
        {forms.map((form) => (
          <div key={form.id} className="app-stuck__row">
            <div className="app-stuck__main">
              <Link to={`/leads/${form.leadId}`} className="app-stuck__name">
                {form.customer?.firstName} {form.customer?.lastName}
              </Link>
              <div className="app-stuck__email">{form.customer?.email}</div>
            </div>
            <div className="app-stuck__meta">
              <span className="iz-tnum">{form.completionPercent}%</span>
              <div className="app-stuck__time">{timeAgo(form.updatedAt)}</div>
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);
