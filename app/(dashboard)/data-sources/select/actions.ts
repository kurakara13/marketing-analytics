"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { persistConnections } from "@/lib/connections";
import { clearPending, readPending } from "@/lib/oauth-pending-cookie";
import { requireConnector } from "@/lib/connectors/registry";

const inputSchema = z.object({
  selectedAccountIds: z.array(z.string().min(1)).min(1),
});

export type ConfirmResult = { error: string } | undefined;

export async function confirmSelectionAction(
  input: z.infer<typeof inputSchema>,
): Promise<ConfirmResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Tidak ada session aktif" };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Pilih minimal satu akun untuk dihubungkan." };
  }

  const pending = await readPending();
  if (!pending) {
    return {
      error: "Sesi OAuth expired (5 menit). Klik Connect dari awal lagi.",
    };
  }
  if (pending.userId !== session.user.id) {
    await clearPending();
    return { error: "Sesi OAuth user mismatch." };
  }

  // Filter pending.accounts to only the IDs the user actually checked.
  const selectedIds = new Set(parsed.data.selectedAccountIds);
  const selectedAccounts = pending.accounts.filter((a) =>
    selectedIds.has(a.id),
  );
  if (selectedAccounts.length === 0) {
    return { error: "Akun yang dipilih tidak cocok dengan yang tersedia." };
  }

  const connector = requireConnector(pending.connectorId);

  try {
    await persistConnections({
      userId: session.user.id,
      connectorId: connector.id,
      tokens: pending.tokens,
      accounts: selectedAccounts,
    });
  } catch (err) {
    console.error("[select.confirm] persistConnections failed:", err);
    return { error: "Gagal simpan koneksi. Cek log dev server." };
  }

  await clearPending();
  revalidatePath("/data-sources");

  // Redirect outside try/catch — redirect throws NEXT_REDIRECT.
  redirect(
    `/data-sources?status=connected&connector=${connector.id}&count=${selectedAccounts.length}`,
  );
}

export async function cancelSelectionAction(): Promise<void> {
  await clearPending();
  redirect("/data-sources?status=cancelled");
}
