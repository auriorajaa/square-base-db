"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const sections = [
  {
    label: "Manage",
    items: [{ label: "Users", segment: "users" }],
  },
  {
    label: "Configuration",
    items: [
      { label: "Sign In / Providers", segment: "providers" },
      { label: "URL Configuration", segment: "url-configuration" },
    ],
  },
] as const;

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  // In the horizontal (top) layout, keep the active tab visible on narrow screens.
  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }, [active]);

  return (
    <Link
      ref={ref}
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

// Breakpoints here are container queries (@4xl), not viewport ones: the dashboard
// already has its own sidebar, so the viewport width says little about how much
// room this area actually has. Below 56rem the nav becomes a tab strip on top.
export function ProjectAuthShell({
  orgSlug,
  projectSlug,
  children,
}: {
  orgSlug: string;
  projectSlug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/organizations/${orgSlug}/${projectSlug}/auth`;

  function isActive(segment: string) {
    return (
      pathname === `${base}/${segment}` ||
      pathname.startsWith(`${base}/${segment}/`)
    );
  }

  return (
    <div className="@container h-full min-h-0 w-full">
      <div className="flex h-full min-h-0 w-full flex-col @4xl:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-border bg-background @4xl:w-56 @4xl:overflow-y-auto @4xl:border-b-0 @4xl:border-r">
          <div className="hidden border-b border-border px-4 py-4 @4xl:block">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Authentication
            </p>
          </div>

          <nav
            aria-label="Authentication"
            className="flex items-center gap-1 overflow-x-auto p-2 @4xl:flex-col @4xl:items-stretch @4xl:gap-6 @4xl:overflow-visible @4xl:p-3"
          >
            {sections.map((section, index) => (
              <div
                key={section.label}
                className={cn(
                  "flex shrink-0 items-center gap-1 @4xl:block @4xl:space-y-1",
                  index > 0 &&
                    "ml-1 border-l border-border pl-2 @4xl:ml-0 @4xl:border-l-0 @4xl:pl-0",
                )}
              >
                <p className="hidden px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground @4xl:block">
                  {section.label}
                </p>
                <div className="flex gap-1 @4xl:flex-col">
                  {section.items.map(({ label, segment }) => (
                    <NavLink
                      key={segment}
                      href={`${base}/${segment}`}
                      active={isActive(segment)}
                    >
                      {label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* The pages inside don't add their own outer padding; it comes from here. */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 @2xl:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
