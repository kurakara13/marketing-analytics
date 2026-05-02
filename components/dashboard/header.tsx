import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { HeaderBreadcrumb } from "./header-breadcrumb";
import { HeaderCommandTrigger } from "./header-command-trigger";

type HeaderProps = {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

// Top header — Direction A "Quiet Refinement".
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │  Today › Dashboard            [🔍  Cari insight…   ⌘K]       │
//   └──────────────────────────────────────────────────────────────┘
//
// Hairline border bottom + soft backdrop blur so content scrolling
// under reads as "behind glass". Editorial breadcrumb on the left
// (italic-serif eyebrow + sans page name), command-palette trigger
// (visual placeholder) on the right. User card lives in the sidebar
// bottom on desktop, so on desktop the right side stays quiet —
// just the search affordance.
//
// Mobile keeps the hamburger + UserMenu since the sidebar is hidden
// behind a sheet there.
export function Header({ user }: HeaderProps) {
  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 backdrop-blur-md md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav />
        <HeaderBreadcrumb />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <HeaderCommandTrigger />
        <div className="flex items-center md:hidden">
          <UserMenu name={user.name} email={user.email} image={user.image} />
        </div>
      </div>
    </header>
  );
}
