import Link from "next/link";
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
    <div className="bg-muted/30 flex min-h-screen flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="w-full max-w-md">{children}</div>
      <footer className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]">
        <span>
          © {new Date().getFullYear()} PT Ekspansi Bisnis Indonesia
        </span>
        <Link
          href="/privacy"
          className="hover:text-foreground hover:underline underline-offset-4"
        >
          Privacy
        </Link>
        <Link
          href="/terms"
          className="hover:text-foreground hover:underline underline-offset-4"
        >
          Terms
        </Link>
        <a
          href="mailto:jihad@xpnd.co.id"
          className="hover:text-foreground hover:underline underline-offset-4"
        >
          Contact
        </a>
      </footer>
    </div>
  );
}
