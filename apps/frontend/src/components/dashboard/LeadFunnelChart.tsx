import React from "react";
import { FunnelChart, Funnel, Tooltip, LabelList, ResponsiveContainer } from "recharts";

interface LeadFunnelChartProps {
  data: { name: string; value: number }[];
}

export const LeadFunnelChart: React.FC<LeadFunnelChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <FunnelChart>
        <Tooltip
          formatter={(value: number) => value.toLocaleString()}
          cursor={{ fill: "rgba(56, 189, 248, 0.08)" }}
        />
        <Funnel dataKey="value" data={data} isAnimationActive>
          <LabelList position="right" dataKey="name" fill="#0f172a" stroke="none" />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
};
