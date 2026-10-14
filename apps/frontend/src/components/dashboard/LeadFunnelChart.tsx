import React from "react";
import { FunnelChart, Funnel, Tooltip, LabelList, ResponsiveContainer } from "recharts";

interface LeadFunnelChartProps {
  data: { name: string; value: number }[];
}

const tooltipStyle = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "var(--shadow-md)",
  fontSize: 12,
};

export const LeadFunnelChart: React.FC<LeadFunnelChartProps> = ({ data }) => {
  const coloredData = data.map((item) => ({ ...item, fill: "var(--chart-1)" }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <FunnelChart>
        <Tooltip
          formatter={(value: number) => value.toLocaleString()}
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--surface-subtle)" }}
        />
        <Funnel dataKey="value" data={coloredData} isAnimationActive stroke="var(--surface)">
          <LabelList
            position="right"
            dataKey="name"
            fill="var(--ink)"
            stroke="none"
            style={{ fontSize: 12, fontFamily: "var(--font-sans)" }}
          />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
};
