"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
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

type Initial = {
  industry: string | null;
  targetAudience: string | null;
  brandVoice: BrandVoice | null;
  businessGoals: string | null;
  leadEventName: string | null;
} | null;

type Props = {
  initial: Initial;
};

const TEXTAREA_CLASS = cn(
  "border-input bg-transparent placeholder:text-muted-foreground/60",
  "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring",
  "min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none transition",
  "resize-y",
);

export function BusinessContextForm({ initial }: Props) {
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
  const [leadEventName, setLeadEventName] = useState(
    initial?.leadEventName ?? "",
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveBusinessContextAction({
        industry: industry.trim() || null,
        targetAudience: targetAudience.trim() || null,
        brandVoice: brandVoice === "" ? null : brandVoice,
        businessGoals: businessGoals.trim() || null,
        leadEventName: leadEventName.trim() || null,
      });
      if ("error" in result) {
        toast.error(`Gagal menyimpan: ${result.error}`);
        return;
      }
      toast.success("Konteks bisnis tersimpan.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-event">GA4 lead event name</Label>
        <Input
          id="lead-event"
          value={leadEventName}
          onChange={(e) => setLeadEventName(e.target.value)}
          placeholder="Contoh: generate_lead, form_submit, book_demo"
          maxLength={100}
        />
        <p className="text-muted-foreground text-xs">
          Event GA4 yang menurut Anda = "lead" di bisnis ini. AI akan pakai
          istilah ini secara konsisten saat membahas leads.
        </p>
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
