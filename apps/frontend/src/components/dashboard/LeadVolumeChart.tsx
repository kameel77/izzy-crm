import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface LeadVolumeChartProps {
  data: { date: string; count: number }[];
}

const axisTick = { fill: "var(--ink-tertiary)", fontSize: 12, fontFamily: "var(--font-sans)" };
const tooltipStyle = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "var(--shadow-md)",
  fontSize: 12,
};

export const LeadVolumeChart: React.FC<LeadVolumeChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" tick={axisTick} stroke="var(--border)" />
        <YAxis tick={axisTick} allowDecimals={false} stroke="var(--border)" />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--ink)" }} />
        <Legend />
        <Line
          type="monotone"
          dataKey="count"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--chart-1)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
