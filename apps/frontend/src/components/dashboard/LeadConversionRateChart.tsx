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

export const LeadConversionRateChart: React.FC<LeadConversionRateChartProps> = ({ data }) => {
  const formatPercent = (value: number) => `${Math.round(value * 1000) / 10}%`;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 12 }} />
        <YAxis
          tickFormatter={formatPercent}
          tick={{ fill: "#475569", fontSize: 12 }}
          domain={[0, 1]}
        />
        <Tooltip
          formatter={(value: number) => formatPercent(value)}
          cursor={{ fill: "rgba(14, 165, 233, 0.08)" }}
        />
        <Legend />
        <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};
