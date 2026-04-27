"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RANGES = [
  { value: "7", label: "7 hari terakhir" },
  { value: "14", label: "14 hari terakhir" },
  { value: "30", label: "30 hari terakhir" },
  { value: "60", label: "60 hari terakhir" },
  { value: "90", label: "90 hari terakhir" },
] as const;

export const RANGE_VALUES = RANGES.map((r) => Number(r.value));

type Props = {
  defaultDays: number;
};

export function RangePicker({ defaultDays }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentValue = searchParams.get("days") ?? String(defaultDays);

  function handleChange(value: string | null) {
    if (value === null) return;
    const params = new URLSearchParams(searchParams);
    if (Number(value) === defaultDays) {
      params.delete("days");
    } else {
      params.set("days", value);
    }
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/dashboard?${query}` : "/dashboard", {
        scroll: false,
      });
    });
  }

  return (
    <Select
      value={currentValue}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RANGES.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
