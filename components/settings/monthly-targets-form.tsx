"use client";

import { useState, useTransition } from "react";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  setMonthlyTargetAction,
  deleteMonthlyTargetAction,
} from "@/app/(dashboard)/settings/actions";

const MONTH_LABELS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

type ExistingTarget = {
  year: number;
  month: number;
  metric: string;
  value: number;
};

type Props = {
  targets: ExistingTarget[];
};

const numberFmt = new Intl.NumberFormat("id-ID");

export function MonthlyTargetsForm({ targets }: Props) {
  const [isPending, startTransition] = useTransition();

  const today = new Date();
  const defaultYear = today.getFullYear();
  const defaultMonth = today.getMonth() + 1;

  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numericValue = Number(value.replace(/[^\d]/g, ""));
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      toast.error("Target harus berupa angka positif");
      return;
    }

    startTransition(async () => {
      const result = await setMonthlyTargetAction({
        year,
        month,
        metric: "sessions",
        value: numericValue,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Target ${MONTH_LABELS[month - 1]} ${year}: ${numberFmt.format(numericValue)} sessions`,
      );
      setValue("");
    });
  }

  function handleDelete(target: ExistingTarget) {
    startTransition(async () => {
      const result = await deleteMonthlyTargetAction({
        year: target.year,
        month: target.month,
        metric: target.metric,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Target ${MONTH_LABELS[target.month - 1]} ${target.year} dihapus`,
      );
    });
  }

  // Year picker covers ±2 years from today.
  const yearOptions: number[] = [];
  for (let y = defaultYear - 2; y <= defaultYear + 2; y++) yearOptions.push(y);

  // Sort existing targets newest-first.
  const sorted = [...targets].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.month - a.month;
  });

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target-year">Tahun</Label>
          <Select
            value={String(year)}
            onValueChange={(v) => v && setYear(Number(v))}
          >
            <SelectTrigger id="target-year" disabled={isPending}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target-month">Bulan</Label>
          <Select
            value={String(month)}
            onValueChange={(v) => v && setMonth(Number(v))}
          >
            <SelectTrigger id="target-month" disabled={isPending}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_LABELS.map((label, i) => (
                <SelectItem key={label} value={String(i + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target-value">Target Sessions</Label>
          <Input
            id="target-value"
            type="text"
            inputMode="numeric"
            placeholder="contoh: 4000"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={isPending} className="w-full">
            <Save className="size-4" />
            {isPending ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </form>

      {sorted.length > 0 ? (
        <div className="border-border rounded-md border">
          <div className="bg-muted/50 grid grid-cols-[1fr_1fr_auto] gap-3 px-3 py-2 text-xs font-medium uppercase tracking-wide">
            <span>Periode</span>
            <span className="text-right">Target Sessions</span>
            <span className="w-9" />
          </div>
          <ul>
            {sorted.map((t) => (
              <li
                key={`${t.year}-${t.month}-${t.metric}`}
                className="border-border grid grid-cols-[1fr_1fr_auto] items-center gap-3 border-t px-3 py-2 text-sm"
              >
                <span>
                  {MONTH_LABELS[t.month - 1]} {t.year}
                </span>
                <span className="text-right font-mono">
                  {numberFmt.format(t.value)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(t)}
                  disabled={isPending}
                  aria-label={`Hapus target ${MONTH_LABELS[t.month - 1]} ${t.year}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Belum ada target. Tambah target di atas — minimal 4 bulan terakhir
          supaya chart Sessions vs Target di report-nya terisi penuh.
        </p>
      )}
    </div>
  );
}
