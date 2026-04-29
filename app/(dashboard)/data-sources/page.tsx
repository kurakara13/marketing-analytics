import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { History } from "lucide-react";

import { auth } from "@/lib/auth";
import { connectors } from "@/lib/connectors/registry";
import { listConnectionsWithSyncForUser } from "@/lib/connections";
import { ConnectorCard } from "@/components/data-sources/connector-card";
import { OAuthStatusToast } from "@/components/data-sources/oauth-status-toast";
import { SyncAllButton } from "@/components/data-sources/sync-all-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function DataSourcesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const allConnections = await listConnectionsWithSyncForUser(session.user.id);

  const hasActiveConnection = allConnections.some(
    (c) =>
      c.status === "active" && !c.externalAccountId.startsWith("_pending_"),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Data Sources
          </h1>
          <p className="text-muted-foreground text-sm">
            Hubungkan platform iklan dan analitik Anda. Setiap koneksi
            memberikan akses read-only ke data Anda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveConnection ? (
            <Link
              href="/data-sources/history"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <History className="size-4" />
              History
            </Link>
          ) : null}
          {hasActiveConnection ? <SyncAllButton /> : null}
        </div>
      </div>

      {/* Suspense is required because OAuthStatusToast uses useSearchParams,
          which deopts the route to client rendering otherwise. */}
      <Suspense fallback={null}>
        <OAuthStatusToast />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-2">
        {connectors.map((connector) => {
          const connectorConnections = allConnections.filter(
            (c) => c.connectorId === connector.id,
          );
          return (
            <ConnectorCard
              key={connector.id}
              connector={connector}
              connections={connectorConnections}
            />
          );
        })}
      </div>
    </div>
  );
}
