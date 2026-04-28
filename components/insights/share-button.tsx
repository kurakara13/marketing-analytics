"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link as LinkIcon, X } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  enableShareAction,
  revokeShareAction,
} from "@/app/(dashboard)/insights/share-actions";

type Props = {
  insightId: string;
  initialToken: string | null;
};

// Inline "Share" button on each insight card. Click opens a popover:
//
//   - If sharing is OFF: a button to enable + short blurb explaining
//     anyone with the link can read.
//   - If sharing is ON: the public URL with a copy button + a
//     "Stop sharing" link that revokes the token (link 404s after).
//
// Optimistic local state for the token so the URL appears instantly
// after enabling; on server error we revert and toast.
export function ShareButton({ insightId, initialToken }: Props) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const url =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/share/insight/${token}`
      : null;

  function handleEnable() {
    startTransition(async () => {
      const result = await enableShareAction({ insightId });
      if ("error" in result) {
        toast.error(`Gagal aktifkan: ${result.error}`);
        return;
      }
      setToken(result.token);
      toast.success("Share link aktif.");
    });
  }

  function handleRevoke() {
    startTransition(async () => {
      const result = await revokeShareAction({ insightId });
      if ("error" in result) {
        toast.error(`Gagal revoke: ${result.error}`);
        return;
      }
      setToken(null);
      toast.success("Share link sudah di-revoke.");
    });
  }

  function handleCopy() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        toast.success("Link tersalin.");
        setTimeout(() => setCopied(false), 1800);
      },
      () => toast.error("Browser tidak izinkan akses clipboard."),
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "shrink-0",
        )}
      >
        <LinkIcon className="size-3.5" />
        Share
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        {!token ? (
          <div className="flex flex-col gap-3">
            <div>
              <h4 className="text-sm font-semibold">Public share link</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Aktifkan untuk membuat URL publik tanpa login. Siapa saja
                yang punya link bisa baca insight ini sampai Anda revoke.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleEnable}
              disabled={isPending}
            >
              <LinkIcon className="size-3.5" />
              {isPending ? "Mengaktifkan..." : "Aktifkan share link"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <h4 className="text-sm font-semibold">Share link aktif</h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Salin URL di bawah. Read-only — pembaca tidak bisa edit /
                generate / akses dashboard Anda.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Input value={url ?? ""} readOnly className="h-8 text-xs" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRevoke}
              disabled={isPending}
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950"
            >
              <X className="size-3.5" />
              Stop sharing (revoke)
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
