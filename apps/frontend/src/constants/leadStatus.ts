export const LEAD_STATUSES = [
  "NEW",
  "FIRST_CONTACT",
  "FOLLOW_UP",
  "VERIFICATION",
  "UNQUALIFIED",
  "GATHERING_DOCUMENTS",
  "CREDIT_ANALYSIS",
  "OFFER_PRESENTED",
  "NEGOTIATIONS",
  "TERMS_ACCEPTED",
  "CONTRACT_IN_PREPARATION",
  "CONTRACT_SIGNING",
  "CLOSED_WON",
  "CLOSED_LOST",
  "CLOSED_NO_FINANCING",
  "CANCELLED",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  FIRST_CONTACT: "First Contact",
  FOLLOW_UP: "Follow-up",
  VERIFICATION: "Verification",
  UNQUALIFIED: "Unqualified",
  GATHERING_DOCUMENTS: "Gathering Documents",
  CREDIT_ANALYSIS: "Credit Analysis",
  OFFER_PRESENTED: "Offer Presented",
  NEGOTIATIONS: "Negotiations",
  TERMS_ACCEPTED: "Terms Accepted",
  CONTRACT_IN_PREPARATION: "Contract in Preparation",
  CONTRACT_SIGNING: "Contract Signing",
  CLOSED_WON: "Closed - Won",
  CLOSED_LOST: "Closed - Lost",
  CLOSED_NO_FINANCING: "Closed - No Financing",
  CANCELLED: "Cancelled",
};
