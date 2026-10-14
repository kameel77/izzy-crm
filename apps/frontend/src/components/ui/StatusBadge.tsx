import React from "react";
import { LEAD_STATUS_LABELS } from "../../constants/leadStatus";
import type { LeadStatus } from "../../constants/leadStatus";
import { Badge } from "./Badge";
import type { Tone } from "./Badge";
import type { IconName } from "./Icon";

export interface StatusBadgeProps {
  status: LeadStatus;
  /** Override the default sentence-case label (e.g. a translation). */
  label?: string;
  className?: string;
}

const STATUS_STYLE: Record<LeadStatus, { tone: Tone; icon?: IconName }> = {
  NEW: { tone: "info" },
  ONBOARDING_CONFIRMED: { tone: "info" },
  FIRST_CONTACT: { tone: "accent" },
  FOLLOW_UP: { tone: "accent" },
  VERIFICATION: { tone: "accent" },
  UNQUALIFIED: { tone: "neutral" },
  GATHERING_DOCUMENTS: { tone: "warning" },
  CREDIT_ANALYSIS: { tone: "accent" },
  OFFER_PRESENTED: { tone: "accent" },
  NEGOTIATIONS: { tone: "accent" },
  TERMS_ACCEPTED: { tone: "success" },
  CONTRACT_IN_PREPARATION: { tone: "success" },
  CONTRACT_SIGNING: { tone: "success" },
  CLOSED_WON: { tone: "success", icon: "check" },
  CLOSED_LOST: { tone: "danger", icon: "x" },
  CLOSED_NO_FINANCING: { tone: "danger", icon: "x" },
  CANCELLED: { tone: "neutral", icon: "x" },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className }) => {
  const style = STATUS_STYLE[status];
  const text = label || LEAD_STATUS_LABELS[status] || status;
  if (!style) {
    return (
      <Badge tone="neutral" dot className={className}>
        {text}
      </Badge>
    );
  }
  return (
    <Badge tone={style.tone} dot={!style.icon} icon={style.icon} className={className}>
      {text}
    </Badge>
  );
};
