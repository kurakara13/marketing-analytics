"use client";

import { Fragment, useDeferredValue, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Client-side filter wrapper around the pre-rendered InsightCard
// list. The server page passes:
//   - `items`: searchable text per insight (id + title + summary +
//     observation/recommendation titles concatenated)
//   - `children`: an array of pre-rendered InsightCard server
//     components, parallel to `items`
//
// We render the search input + only show children whose searchable
// text matches the query. useDeferredValue keeps typing snappy on
// large lists by deferring the filter pass.

type FilterableItem = {
  id: string;
  searchText: string;
};

type Props = {
  items: FilterableItem[];
  children: React.ReactNode[];
};

export function InsightsFilter({ items, children }: Props) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalized = deferredQuery.trim().toLowerCase();

  const matchedIndices = useMemo(() => {
    if (normalized === "") return items.map((_, i) => i);
    return items
      .map((item, i) =>
        item.searchText.toLowerCase().includes(normalized) ? i : -1,
      )
      .filter((i) => i >= 0);
  }, [items, normalized]);

  const isFiltering = normalized.length > 0;
  const matchCount = matchedIndices.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground/60 absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari di title, summary, observation, atau rekomendasi…"
            className="pl-8 pr-8"
            aria-label="Cari insights"
          />
          {query.length > 0 ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        {isFiltering ? (
          <span className="text-muted-foreground shrink-0 text-xs">
            {matchCount} / {items.length}
          </span>
        ) : null}
      </div>

      {isFiltering && matchCount === 0 ? (
        <div className="border-border/60 bg-muted/30 rounded-md border border-dashed px-4 py-8 text-center">
          <p className="text-muted-foreground text-sm">
            Tidak ada insight yang match dengan "{query}".
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {matchedIndices.map((i) => (
            <Fragment key={items[i].id}>{children[i]}</Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// Eslint: unused import guard
void cn;
