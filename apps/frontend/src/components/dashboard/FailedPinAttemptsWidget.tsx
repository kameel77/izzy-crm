import React from "react";

import { Badge, StatCard } from "../ui";

interface FailedPinAttemptsWidgetProps {
  count: number;
  rangeDays: number;
  loading: boolean;
}

export const FailedPinAttemptsWidget: React.FC<FailedPinAttemptsWidgetProps> = ({
  count,
  rangeDays,
  loading,
}) => (
  <StatCard
    label="Nieudane próby PIN"
    icon="shield"
    value={loading ? "…" : count}
    compareLabel={`w ciągu ostatnich ${rangeDays} dni`}
    actions={
      !loading && count > 0 ? (
        <Badge tone="danger" icon="alert">
          Sprawdź
        </Badge>
      ) : undefined
    }
  />
);
