import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

// Full-bleed layout for the report builder. No sidebar / no app
// header — the editor's own toolbar handles navigation back to
// /reports. Keeps the entire viewport available for the canvas.
export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    // h-screen + overflow-hidden locks the editor to exactly the viewport
    // height. All scroll is delegated to individual panels (slide list,
    // canvas, side panel) via min-h-0 + overflow-y-auto inside each.
    // Without this lock, panels with tall content push the page past
    // 100vh, the browser shows a scrollbar, and switching panels causes
    // a layout jump as the page height changes.
    <div className="bg-muted/20 flex h-screen flex-col overflow-hidden">
      <main className="flex flex-1 flex-col overflow-hidden p-4 md:p-5">
        {children}
      </main>
    </div>
  );
}
