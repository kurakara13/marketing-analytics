import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertCircle,
  Megaphone,
  Search,
  type LucideIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Connector } from "@/lib/connectors/types";
import type { ConnectionWithLastSync } from "@/lib/connections";
import { ConnectionMenu } from "./connection-menu";

type Props = {
  connector: Connector;
  connections: ConnectionWithLastSync[];
};

const CONNECTOR_ICONS: Record<string, LucideIcon> = {
  ga4: BarChart3,
  google_ads: Megaphone,
  search_console: Search,
};

function isPending(connection: ConnectionWithLastSync): boolean {
  return connection.externalAccountId.startsWith("_pending_");
}

function LastSyncLine({ conn }: { conn: ConnectionWithLastSync }) {
  if (!conn.lastSync) {
    return (
      <div className="text-muted-foreground text-xs">Belum pernah sync.</div>
    );
  }

  const { lastSync } = conn;
  const ago = formatDistanceToNow(lastSync.startedAt, {
    addSuffix: true,
    locale: idLocale,
  });

  if (lastSync.status === "running") {
    return (
      <div className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <Clock className="size-3" /> Sedang sync...
      </div>
    );
  }

  if (lastSync.status === "error") {
    return (
      <div className="text-destructive inline-flex items-start gap-1 text-xs">
        <AlertCircle className="mt-0.5 size-3 shrink-0" />
        {/* suppressHydrationWarning: `ago` is computed from Date.now() at
            render time, so the server-rendered string can drift by a few
            milliseconds vs the client hydration value. The displayed text
            is correct in both cases. */}
        <span className="break-words" suppressHydrationWarning>
          Sync gagal {ago}: {lastSync.errorMessage ?? "(tanpa pesan)"}
        </span>
      </div>
    );
  }

  return (
    <div className="text-muted-foreground text-xs" suppressHydrationWarning>
      Sync terakhir {ago} — {lastSync.recordsCount ?? 0} baris.
    </div>
  );
}

export function ConnectorCard({ connector, connections }: Props) {
  const isConnected = connections.length > 0;
  const connectHref = `/api/connectors/${connector.provider}/connect?connector=${connector.id}`;
  const Icon = CONNECTOR_ICONS[connector.id] ?? BarChart3;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-md">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="leading-tight">{connector.name}</CardTitle>
            <CardDescription className="mt-1">
              {connector.description}
            </CardDescription>
          </div>
          {isConnected ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
              <CheckCircle2 className="size-3" /> Connected
            </span>
          ) : (
            <span className="bg-muted text-muted-foreground inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium">
              Not connected
            </span>
          )}
        </div>
      </CardHeader>

      {isConnected ? (
        <>
          <Separator />
          <CardContent className="pt-4">
            <ul className="grid gap-4 text-sm">
              {connections.map((conn) => {
                const pending = isPending(conn);
                const accountName =
                  conn.externalAccountName ?? conn.externalAccountId;
                return (
                  <li key={conn.id} className="grid gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {accountName}
                          </span>
                          {pending ? (
                            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                              <Clock className="size-3" /> pending
                            </span>
                          ) : null}
                        </div>
                        <div className="text-muted-foreground truncate font-mono text-xs">
                          {conn.externalAccountId}
                        </div>
                      </div>
                      <ConnectionMenu
                        connectionId={conn.id}
                        accountName={accountName}
                      />
                    </div>
                    {!pending ? <LastSyncLine conn={conn} /> : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </>
      ) : null}

      <CardFooter className="mt-auto">
        <Link
          href={connectHref}
          className={cn(buttonVariants({ variant: "default" }), "w-full")}
        >
          {isConnected ? "Tambahkan akun lain" : "Connect with Google"}
        </Link>
      </CardFooter>
    </Card>
  );
}
