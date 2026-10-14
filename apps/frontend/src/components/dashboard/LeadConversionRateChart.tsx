import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface LeadConversionRateChartProps {
  data: { name: string; value: number }[];
}

const axisTick = { fill: "var(--ink-tertiary)", fontSize: 12, fontFamily: "var(--font-sans)" };
const tooltipStyle = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "var(--shadow-md)",
  fontSize: 12,
};

export const LeadConversionRateChart: React.FC<LeadConversionRateChartProps> = ({ data }) => {
  const formatPercent = (value: number) => `${Math.round(value * 1000) / 10}%`;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" tick={axisTick} stroke="var(--border)" />
        <YAxis
          tickFormatter={formatPercent}
          tick={axisTick}
          domain={[0, 1]}
          stroke="var(--border)"
        />
        <Tooltip
          formatter={(value: number) => formatPercent(value)}
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--surface-subtle)" }}
        />
        <Legend />
        <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};
