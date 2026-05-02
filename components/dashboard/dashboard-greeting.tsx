"use client";

import { useEffect, useState } from "react";

const ID_DAYS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
const ID_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function pickGreeting(hour: number): string {
  if (hour < 4) return "Masih semangat";
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

// Greeting block — Direction A "Quiet Refinement". Date in the
// editorial display serif as the eyebrow; greeting line in the
// stronger sans. Time-of-day phrase shifts based on local hour
// (computed client-side so it matches the user's wall clock, not
// server timezone).
export function DashboardGreeting({ name }: { name?: string | null }) {
  // Render the date on initial mount only — avoid hydration mismatch
  // between server (UTC) and client (local). On first paint we show
  // a quiet placeholder, then update once mounted.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  if (!now) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-muted-foreground/70 font-display text-xs italic">
          &nbsp;
        </span>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
          {name ? `Selamat datang, ${name}.` : "Selamat datang."}
        </h1>
      </div>
    );
  }

  const greeting = pickGreeting(now.getHours());
  const dateLabel = `${ID_DAYS[now.getDay()]}, ${now.getDate()} ${ID_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const titleName = name ? `${greeting}, ${name}.` : `${greeting}.`;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground/70 font-display text-xs italic tracking-wide">
        {dateLabel}
      </span>
      <h1 className="text-foreground font-display text-3xl font-medium leading-[1.1] tracking-tight sm:text-[34px]">
        {titleName}
      </h1>
    </div>
  );
}
