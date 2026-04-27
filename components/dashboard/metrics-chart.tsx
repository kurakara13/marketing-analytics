"use client";

import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartPoint = {
  date: string;
  sessions: number;
  conversions: number;
};

type Props = {
  data: ChartPoint[];
};

const numberFmt = new Intl.NumberFormat("id-ID");

export function MetricsChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-72 items-center justify-center text-sm">
        Belum ada data untuk window ini.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) =>
            format(parseISO(value), "d MMM", { locale: idLocale })
          }
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => numberFmt.format(value)}
        />
        <Tooltip
          labelFormatter={(label) => {
            if (typeof label !== "string") return "";
            return format(parseISO(label), "EEEE, d MMMM yyyy", {
              locale: idLocale,
            });
          }}
          formatter={(value, name) => {
            const n = typeof value === "number" ? value : Number(value ?? 0);
            const display =
              name === "sessions"
                ? "Sessions"
                : name === "conversions"
                  ? "Conversions"
                  : String(name);
            return [numberFmt.format(n), display];
          }}
          contentStyle={{
            background: "var(--color-popover)",
            color: "var(--color-popover-foreground)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
          }}
        />
        <Line
          type="monotone"
          dataKey="sessions"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="conversions"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
