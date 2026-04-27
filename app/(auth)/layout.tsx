import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Public routes (login, register). If already signed in, send users
// straight to /dashboard so they can't get stuck on the login screen.
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="bg-muted/30 flex min-h-screen flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
