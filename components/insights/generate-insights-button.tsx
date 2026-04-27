"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generateInsightAction } from "@/app/(dashboard)/insights/actions";

export function GenerateInsightsButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await generateInsightAction();
      if ("error" in result) {
        toast.error(`Generate gagal: ${result.error}`);
        return;
      }
      toast.success("Insight baru tersimpan.");
    });
  }

  return (
    <Button onClick={handleClick} disabled={isPending}>
      <Sparkles className={cn("size-4", isPending && "animate-pulse")} />
      {isPending ? "Menganalisis..." : "Generate insight"}
    </Button>
  );
}
