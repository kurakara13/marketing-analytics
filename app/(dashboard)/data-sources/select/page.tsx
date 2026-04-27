import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getConnector } from "@/lib/connectors/registry";
import { readPending } from "@/lib/oauth-pending-cookie";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SelectForm } from "./select-form";

export default async function SelectAccountsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const pending = await readPending();
  if (!pending) {
    redirect("/data-sources?status=error&reason=missing_oauth_session");
  }

  if (pending.userId !== session.user.id) {
    redirect("/data-sources?status=error&reason=user_mismatch");
  }

  const connector = getConnector(pending.connectorId);
  if (!connector) {
    redirect("/data-sources?status=error&reason=unknown_connector");
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Pilih akun {connector.name}</CardTitle>
          <CardDescription>
            Hanya akun yang dicentang yang akan disimpan dan disinkronkan. Sesi
            seleksi expire dalam 5 menit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SelectForm
            connectorName={connector.name}
            accounts={pending.accounts.map((a) => ({ id: a.id, name: a.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
