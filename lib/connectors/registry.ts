import type { Connector } from "./types";
import { ga4Connector } from "./ga4";
import { googleAdsConnector } from "./google-ads";
import { searchConsoleConnector } from "./search-console";

// Single source of truth for which connectors the app exposes. The Data
// Sources page reads from here; OAuth route handlers also resolve the
// connector by id when starting an authorization flow.
//
// Add new connectors by:
//   1. Implementing `Connector` in lib/connectors/<id>/
//   2. Importing + appending to `connectors` below
export const connectors: readonly Connector[] = [
  ga4Connector,
  googleAdsConnector,
  searchConsoleConnector,
];

export function getConnector(id: string): Connector | undefined {
  return connectors.find((c) => c.id === id);
}

export function requireConnector(id: string): Connector {
  const connector = getConnector(id);
  if (!connector) {
    throw new Error(`Unknown connector: ${id}`);
  }
  return connector;
}
