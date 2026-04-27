import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DesktopSidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-1">
      <DesktopSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={session.user} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
