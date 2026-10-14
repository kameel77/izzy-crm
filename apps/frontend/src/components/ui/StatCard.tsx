import React from "react";
import { Badge } from "./Badge";
import { Card } from "./Card";
import type { IconName } from "./Icon";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** "+12%" or "-4%". Sign decides the arrow unless trend is set. */
  delta?: string;
  trend?: "up" | "down";
  /** true when down is good (e.g. stuck forms, failed PIN attempts). */
  invert?: boolean;
  /** Default "vs last month"; null hides it. */
  compareLabel?: string | null;
  icon?: IconName | React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  delta,
  trend,
  invert,
  compareLabel,
  icon,
  actions,
  className,
}) => {
  const dir = trend || (String(delta || "").trim().charAt(0) === "-" ? "down" : "up");
  const good = invert ? dir === "down" : dir === "up";
  return (
    <Card title={label} icon={icon} className={className} actions={actions}>
      <div className="iz-stat__value-row">
        <span className="iz-stat__value">{value}</span>
        {delta ? (
          <Badge tone={good ? "success" : "danger"} icon={dir === "up" ? "arrow-up-right" : "arrow-down-right"}>
            {delta}
          </Badge>
        ) : null}
        {compareLabel !== null ? <span className="iz-stat__compare">{compareLabel || "vs last month"}</span> : null}
      </div>
    </Card>
  );
};
