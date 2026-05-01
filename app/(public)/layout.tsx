import Link from "next/link";
import { BarChart3 } from "lucide-react";

// Standalone layout for public, unauthenticated pages — Privacy,
// Terms, etc. Renders just the brand header + the legal content,
// no sidebar / no nav. Matches the visual feel of /share/insight
// for visitors who don't have accounts.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/20 flex min-h-screen flex-col">
      <header className="bg-background border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link
            href="/"
            className="text-foreground flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
              <BarChart3 className="size-4" />
            </span>
            Marketing Analytics
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-muted-foreground hover:text-foreground"
            >
              Terms
            </Link>
            <Link
              href="/login"
              className="text-foreground font-medium hover:underline"
            >
              Login
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-4xl flex-col items-start gap-1 px-4 py-6 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} PT Ekspansi Bisnis Indonesia
            (xpnd.co.id). Marketing Analytics — internal tool, private beta.
          </span>
          <span>
            Contact:{" "}
            <a
              href="mailto:jihad@xpnd.co.id"
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              jihad@xpnd.co.id
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
