// Compose searchable text from a full insight on the server side.
// Concatenates title, summary, dates, and ALL observation + recommendation
// titles + descriptions so a substring search hits across any of those
// fields. Lowercase + collapsed whitespace for predictable matching.
//
// This file has NO client/server marker and contains only a pure
// function — safe to import from server pages even though the search
// UI itself is a client component.
export function buildInsightSearchText(insight: {
  title: string | null;
  executiveSummary: string;
  windowStart: string;
  windowEnd: string;
  observations: Array<{ title: string; description: string }>;
  recommendations: Array<{ title: string; description: string }>;
}): string {
  const parts: string[] = [];
  if (insight.title) parts.push(insight.title);
  parts.push(insight.executiveSummary);
  parts.push(`${insight.windowStart} ${insight.windowEnd}`);
  for (const o of insight.observations) {
    parts.push(o.title);
    parts.push(o.description);
  }
  for (const r of insight.recommendations) {
    parts.push(r.title);
    parts.push(r.description);
  }
  return parts.join(" ").replace(/\s+/g, " ");
}
