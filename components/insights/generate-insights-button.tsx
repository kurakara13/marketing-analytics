"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generateInsightAction } from "@/app/(dashboard)/insights/actions";

// GPT-5 dengan adaptive thinking + business context + feedback +
// attribution flags = ~60-120s per generate. Button needs to:
//   1. Show running elapsed seconds so user tahu lagi jalan, not stuck
//   2. Hard-disable selama running supaya double-click tidak fire
//      multiple generations (yang bikin user kira lebih cepet padahal
//      malah waste quota + token).
//   3. Cap visual estimate at 120s — kalau lebih dari itu, switch ke
//      "tunggu sebentar" saja biar tidak merah-tone.
export function GenerateInsightsButton() {
  const [isPending, startTransition] = useTransition();
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  // Tick a 1s interval while pending. Reset on completion.
  useEffect(() => {
    if (!isPending) {
      setElapsedSec(0);
      startedAtRef.current = null;
      return;
    }
    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }
    const id = window.setInterval(() => {
      const start = startedAtRef.current ?? Date.now();
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isPending]);

  function handleClick() {
    if (isPending) return; // belt-and-suspenders against double-fire
    startTransition(async () => {
      const result = await generateInsightAction();
      if ("error" in result) {
        toast.error(`Generate gagal: ${result.error}`);
        return;
      }
      toast.success("Insight baru tersimpan.");
    });
  }

  const label = isPending
    ? elapsedSec < 90
      ? `Menganalisis… ${elapsedSec}s`
      : "Sebentar, hampir selesai…"
    : "Generate insight";

  return (
    <Button onClick={handleClick} disabled={isPending}>
      <Sparkles className={cn("size-4", isPending && "animate-pulse")} />
      {label}
    </Button>
  );
}
