"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Save, Search } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { saveBusinessContextAction } from "@/app/(dashboard)/settings/actions";

type BrandVoice = "professional" | "casual" | "technical";

type DiscoveredEvent = {
  eventName: string;
  eventCount: number;
  sources: string[];
};

type Initial = {
  industry: string | null;
  targetAudience: string | null;
  brandVoice: BrandVoice | null;
  businessGoals: string | null;
  leadEvents: string[] | null;
  leadLabel: string | null;
} | null;

type Props = {
  initial: Initial;
  /** GA4 events discovered from user's connected properties — passed
   *  in from the server page so the picker shows real options with
   *  counts. Empty array when no GA4 connection or fetch failed. */
  discoveredEvents: DiscoveredEvent[];
};

const TEXTAREA_CLASS = cn(
  "border-input bg-transparent placeholder:text-muted-foreground/60",
  "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring",
  "min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none transition",
  "resize-y",
);

const idFmt = new Intl.NumberFormat("id-ID");

export function BusinessContextForm({ initial, discoveredEvents }: Props) {
  const [isPending, startTransition] = useTransition();

  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [targetAudience, setTargetAudience] = useState(
    initial?.targetAudience ?? "",
  );
  const [brandVoice, setBrandVoice] = useState<BrandVoice | "">(
    initial?.brandVoice ?? "",
  );
  const [businessGoals, setBusinessGoals] = useState(
    initial?.businessGoals ?? "",
  );
  const [leadEvents, setLeadEvents] = useState<string[]>(
    initial?.leadEvents ?? [],
  );
  const [leadLabel, setLeadLabel] = useState(initial?.leadLabel ?? "");
  const [eventSearch, setEventSearch] = useState("");

  // Map discovered events for fast lookup of counts. Some events the
  // user already selected might not be in `discoveredEvents` (mis.
  // legacy event no longer firing, or zero count in last 30d) — we
  // still render them so the user can keep or remove them.
  const eventsByName = useMemo(() => {
    const map = new Map(discoveredEvents.map((e) => [e.eventName, e]));
    for (const name of leadEvents) {
      if (!map.has(name)) {
        map.set(name, { eventName: name, eventCount: 0, sources: [] });
      }
    }
    return map;
  }, [discoveredEvents, leadEvents]);

  // Sorted, filtered event list for the picker. Selected events
  // float to top.
  const visibleEvents = useMemo(() => {
    const all = Array.from(eventsByName.values());
    const filter = eventSearch.trim().toLowerCase();
    const filtered = filter
      ? all.filter((e) => e.eventName.toLowerCase().includes(filter))
      : all;
    return filtered.sort((a, b) => {
      const aSel = leadEvents.includes(a.eventName) ? 0 : 1;
      const bSel = leadEvents.includes(b.eventName) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      if (b.eventCount !== a.eventCount) return b.eventCount - a.eventCount;
      return a.eventName.localeCompare(b.eventName);
    });
  }, [eventsByName, leadEvents, eventSearch]);

  // Total count for selected lead events (over the discovery window).
  const selectedCount = useMemo(() => {
    return leadEvents.reduce(
      (sum, name) => sum + (eventsByName.get(name)?.eventCount ?? 0),
      0,
    );
  }, [eventsByName, leadEvents]);

  function toggleEvent(eventName: string) {
    setLeadEvents((prev) =>
      prev.includes(eventName)
        ? prev.filter((n) => n !== eventName)
        : [...prev, eventName],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveBusinessContextAction({
        industry: industry.trim() || null,
        targetAudience: targetAudience.trim() || null,
        brandVoice: brandVoice === "" ? null : brandVoice,
        businessGoals: businessGoals.trim() || null,
        leadEvents: leadEvents.length > 0 ? leadEvents : null,
        leadLabel: leadLabel.trim() || null,
      });
      if ("error" in result) {
        toast.error(`Gagal menyimpan: ${result.error}`);
        return;
      }
      toast.success("Konteks bisnis tersimpan.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="industry">Industri / model bisnis</Label>
        <Input
          id="industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="Contoh: B2B SaaS HR, fashion e-commerce, online course"
          maxLength={500}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="target-audience">Target audience</Label>
        <textarea
          id="target-audience"
          className={TEXTAREA_CLASS}
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          placeholder="Contoh: HR manager mid-market di Indonesia, perusahaan 50–500 karyawan"
          maxLength={500}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brand-voice">Tone narrative AI</Label>
        <Select
          value={brandVoice || "_none"}
          onValueChange={(v) =>
            setBrandVoice(v === "_none" ? "" : (v as BrandVoice))
          }
        >
          <SelectTrigger id="brand-voice">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">(default — profesional)</SelectItem>
            <SelectItem value="professional">Profesional & formal</SelectItem>
            <SelectItem value="casual">Casual & friendly</SelectItem>
            <SelectItem value="technical">Teknis & data-heavy</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="business-goals">Business goals</Label>
        <textarea
          id="business-goals"
          className={TEXTAREA_CLASS}
          value={businessGoals}
          onChange={(e) => setBusinessGoals(e.target.value)}
          placeholder="Contoh: Turunkan CPL di bawah 50K, naikkan MQL 2x, ekspansi ke Surabaya"
          maxLength={1000}
        />
      </div>

      {/* ─── Lead events picker ─────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground text-[13px] font-semibold">
            Definisi Lead
          </Label>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Pilih event GA4 yang Anda anggap "lead". Bisa multi-select —
            misal <code className="bg-background rounded px-1 py-0.5">generate_lead</code>{" "}
            + <code className="bg-background rounded px-1 py-0.5">ebook_download</code>{" "}
            + <code className="bg-background rounded px-1 py-0.5">whatsapp_click</code>.
            AI akan menghitung total ini sebagai "lead", bukan total{" "}
            <code className="bg-background rounded px-1 py-0.5">conversions</code>{" "}
            generik dari GA4.
          </p>
        </div>

        {discoveredEvents.length === 0 && leadEvents.length === 0 ? (
          <p className="text-muted-foreground rounded-md bg-background px-3 py-2 text-xs italic">
            Belum bisa load daftar event GA4 — pastikan koneksi GA4
            aktif dan sudah punya data 30 hari terakhir.
          </p>
        ) : (
          <>
            <div className="relative">
              <Search className="text-muted-foreground/60 absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
              <Input
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                placeholder="Cari event…"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="border-border/60 max-h-72 overflow-y-auto rounded-md border bg-background">
              {visibleEvents.length === 0 ? (
                <p className="text-muted-foreground p-3 text-center text-xs italic">
                  Tidak ada event yang match.
                </p>
              ) : (
                <ul className="divide-border/40 divide-y">
                  {visibleEvents.map((event) => {
                    const isSelected = leadEvents.includes(event.eventName);
                    return (
                      <li key={event.eventName}>
                        <button
                          type="button"
                          onClick={() => toggleEvent(event.eventName)}
                          className={cn(
                            "hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                            isSelected && "bg-emerald-50/40 dark:bg-emerald-950/20",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded border-[1.5px] transition-colors",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border/80 bg-background",
                            )}
                          >
                            {isSelected ? <Check className="size-3" /> : null}
                          </span>
                          <span className="text-foreground min-w-0 flex-1 truncate font-mono text-[12.5px]">
                            {event.eventName}
                          </span>
                          <span className="text-muted-foreground tabular-nums text-[11px]">
                            {event.eventCount > 0
                              ? `~${idFmt.format(event.eventCount)}/30d`
                              : "—"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {leadEvents.length > 0 ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              <strong className="text-foreground tabular-nums">
                {leadEvents.length}
              </strong>{" "}
              event terpilih · ~
              <strong className="text-foreground tabular-nums">
                {idFmt.format(selectedCount)}
              </strong>{" "}
              total / 30 hari
            </span>
            <button
              type="button"
              onClick={() => setLeadEvents([])}
              className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              Clear semua
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="lead-label"
            className="text-foreground text-[12px] font-medium"
          >
            Label custom (opsional)
          </Label>
          <Input
            id="lead-label"
            value={leadLabel}
            onChange={(e) => setLeadLabel(e.target.value)}
            placeholder="Default: lead. Bisa diisi: MQL, qualified action, dll."
            maxLength={50}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          <Save className="size-4" />
          {isPending ? "Menyimpan..." : "Simpan konteks"}
        </Button>
      </div>
    </form>
  );
}
