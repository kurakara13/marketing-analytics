"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarIcon, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { backfillConnectionAction } from "@/app/(dashboard)/data-sources/actions";

type Preset = {
  id: string;
  label: string;
  /** Days before yesterday to start. End is always yesterday. */
  days: number;
};

const PRESETS: Preset[] = [
  { id: "30d", label: "30 hari", days: 30 },
  { id: "90d", label: "90 hari", days: 90 },
  { id: "6m", label: "6 bulan", days: 180 },
  { id: "12m", label: "12 bulan", days: 365 },
  { id: "24m", label: "24 bulan", days: 730 },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function formatDateLabel(d: Date | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  accountName: string;
};

export function BackfillDialog({
  open,
  onOpenChange,
  connectionId,
  accountName,
}: Props) {
  const yesterday = useMemo(() => addDays(new Date(), -1), []);

  // Default to last 12 months — the most common ask for monthly trend.
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: addDays(yesterday, -364),
    to: yesterday,
  }));
  const [isPending, startTransition] = useTransition();

  function applyPreset(preset: Preset) {
    setRange({
      from: addDays(yesterday, -(preset.days - 1)),
      to: yesterday,
    });
  }

  function handleSubmit() {
    if (!range?.from || !range?.to) {
      toast.error("Pilih tanggal mulai dan tanggal akhir");
      return;
    }
    const startDate = isoDate(range.from);
    const endDate = isoDate(range.to);

    startTransition(async () => {
      const result = await backfillConnectionAction({
        connectionId,
        startDate,
        endDate,
      });
      if ("error" in result) {
        toast.error(`Backfill ${accountName} gagal: ${result.error}`);
        return;
      }
      toast.success(
        `Backfill ${accountName}: ${result.recordsCount} baris (${result.rangeStart} → ${result.rangeEnd}).`,
      );
      onOpenChange(false);
    });
  }

  // Active preset = the one whose computed range equals the current range.
  // Lets the preset chips reflect the current selection visually.
  const activePresetId = useMemo(() => {
    if (!range?.from || !range?.to) return null;
    if (isoDate(range.to) !== isoDate(yesterday)) return null;
    for (const p of PRESETS) {
      if (isoDate(addDays(yesterday, -(p.days - 1))) === isoDate(range.from)) {
        return p.id;
      }
    }
    return null;
  }, [range, yesterday]);

  const dayCount =
    range?.from && range?.to
      ? Math.floor(
          (range.to.valueOf() - range.from.valueOf()) / (24 * 60 * 60 * 1000),
        ) + 1
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" />
            Backfill historical data
          </DialogTitle>
          <DialogDescription>
            Tarik data historis untuk{" "}
            <span className="text-foreground font-medium">{accountName}</span>{" "}
            sesuai range tanggal pilihan. Berguna untuk mengisi minggu/bulan
            sebelumnya supaya trend chart di report langsung terisi.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Quick preset
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant={
                    activePresetId === preset.id ? "default" : "outline"
                  }
                  onClick={() => applyPreset(preset)}
                  disabled={isPending}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Custom range
            </div>
            <Popover>
              <PopoverTrigger
                disabled={isPending}
                className={cn(
                  "border-input bg-background hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                <span className="flex items-center gap-2">
                  <CalendarIcon className="size-4" />
                  {range?.from && range?.to
                    ? `${formatDateLabel(range.from)} – ${formatDateLabel(range.to)}`
                    : "Pilih rentang tanggal"}
                </span>
                {dayCount > 0 ? (
                  <span className="text-muted-foreground text-xs">
                    {dayCount} hari
                  </span>
                ) : null}
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0"
                align="start"
                sideOffset={4}
              >
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={setRange}
                  numberOfMonths={2}
                  defaultMonth={range?.from}
                  disabled={{ after: yesterday }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <p className="text-muted-foreground text-xs">
            Catatan: range maksimum 3 tahun. Data hari ini belum lengkap, jadi
            tanggal akhir paling baru adalah kemarin. Re-run untuk window yang
            sama akan menimpa data yang sudah ada (idempotent).
          </p>
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={isPending}>
                Batal
              </Button>
            }
          />
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !range?.from || !range?.to}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <History className="size-4" />
            )}
            {isPending ? "Menarik data…" : "Mulai backfill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
