import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

type HeaderProps = {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

// Top header. On desktop the user lives in the sidebar bottom now,
// so the header is mostly empty (intentional breathing space).
// On mobile it still hosts the hamburger + UserMenu since the
// sidebar is hidden behind a sheet there.
export function Header({ user }: HeaderProps) {
  return (
    <header className="bg-background flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 md:px-6">
      <div className="flex items-center gap-2">
        <MobileNav />
      </div>
      <div className="flex items-center gap-3 md:hidden">
        <UserMenu name={user.name} email={user.email} image={user.image} />
      </div>
    </header>
  );
}
