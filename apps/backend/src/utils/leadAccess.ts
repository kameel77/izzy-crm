import { UserRole } from "@prisma/client";

export const PARTNER_SCOPED_ROLES: UserRole[] = [
  UserRole.PARTNER,
  UserRole.PARTNER_MANAGER,
  UserRole.PARTNER_EMPLOYEE,
];

export const isPartnerScopedRole = (role?: UserRole | null) =>
  Boolean(role && PARTNER_SCOPED_ROLES.includes(role));

export const isOperatorAssignedToLead = (
  user: { role?: UserRole | null; id?: string | null } | undefined,
  lead: { assignedUser?: { id: string | null } | null; assignedUserId?: string | null },
) => {
  const assignedId = lead.assignedUser?.id ?? lead.assignedUserId ?? null;
  return user?.role === UserRole.OPERATOR && Boolean(assignedId && assignedId === user.id);
};

export const canAccessLead = (
  lead: {
    partnerId: string;
    createdByUserId?: string | null;
    assignedUser?: { id: string | null } | null;
    assignedUserId?: string | null;
  },
  user: { role?: UserRole | null; partnerId?: string | null; id?: string | null } | undefined,
) => {
  if (!user) {
    return false;
  }

  const operatorAssigned = isOperatorAssignedToLead(user, lead);

  if (isPartnerScopedRole(user.role)) {
    const partnerId = typeof user.partnerId === "string" ? user.partnerId : null;

    if (!partnerId || lead.partnerId !== partnerId) {
      return false;
    }

    if (user.role === UserRole.PARTNER_EMPLOYEE && lead.createdByUserId !== user.id) {
      return false;
    }

    return true;
  }

  if (user.role === UserRole.OPERATOR) {
    const partnerId = typeof user.partnerId === "string" ? user.partnerId : null;

    if (partnerId) {
      if (lead.partnerId !== partnerId && !operatorAssigned) {
        return false;
      }
    } else if (!operatorAssigned) {
      return false;
    }
  }

  return true;
};
