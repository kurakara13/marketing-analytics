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
import { RANGE_OPTIONS } from "@/lib/dashboard-ranges";

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
        {RANGE_OPTIONS.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
