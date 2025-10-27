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

export const LeadVolumeChart: React.FC<LeadVolumeChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 12 }} />
        <YAxis tick={{ fill: "#475569", fontSize: 12 }} allowDecimals={false} />
        <Tooltip labelStyle={{ color: "#0f172a" }} />
        <Legend />
        <Line type="monotone" dataKey="count" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};
