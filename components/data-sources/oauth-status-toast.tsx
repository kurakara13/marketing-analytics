"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Anda menolak permission. Coba lagi.",
  state_mismatch: "Sesi OAuth tidak valid (state mismatch). Coba lagi.",
  user_mismatch: "User session berubah saat OAuth berjalan. Coba lagi.",
  missing_oauth_session: "Sesi OAuth expired (5 menit). Coba lagi.",
  missing_code_or_state: "Google tidak mengembalikan code/state. Coba lagi.",
  invalid_oauth_session: "Sesi OAuth corrupted. Coba lagi.",
  unknown_connector: "Connector tidak dikenali.",
  token_exchange_failed: "Gagal tukar code dengan token. Cek log dev server.",
  no_accounts_granted:
    "Tidak ada akun yang Anda izinkan. Coba lagi dan centang account-nya.",
  persist_failed: "Gagal simpan koneksi ke database. Cek log dev server.",
  list_accounts_failed:
    "Gagal mengambil daftar akun dari platform. Cek setup connector (mis. developer token Google Ads).",
};

export function OAuthStatusToast() {
  const router = useRouter();
  const params = useSearchParams();

  // Strict mode mounts effects twice in dev — guard so we only toast once
  // per query string change.
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const status = params.get("status");
    if (!status) return;

    const key = params.toString();
    if (handledRef.current === key) return;
    handledRef.current = key;

    const connector = params.get("connector") ?? "Connector";
    const count = params.get("count");

    if (status === "connected") {
      toast.success(`${connector} terhubung — ${count ?? "?"} akun tersimpan.`);
    } else if (status === "error") {
      const reason = params.get("reason") ?? "unknown";
      const detail = params.get("detail");
      const base = ERROR_MESSAGES[reason] ?? `OAuth gagal: ${reason}`;
      toast.error(detail ? `${base}\n\n${detail}` : base);
    }

    // Clean up the URL so refreshing the page doesn't re-toast.
    router.replace("/data-sources", { scroll: false });
  }, [params, router]);

  return null;
}
