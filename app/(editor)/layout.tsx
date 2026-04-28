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
    <div className="flex min-h-screen flex-1 flex-col">
      <main className="flex flex-1 flex-col overflow-hidden p-3 md:p-4">
        {children}
      </main>
    </div>
  );
}
