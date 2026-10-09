"use client";

import Link from "next/link";
import {useParams, usePathname} from "next/navigation";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Code2,
  FolderOpen,
  Home,
  LogOut,
  Plus,
  Radio,
  Settings,
  ShieldCheck,
  Table2,
  TerminalSquare,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {Avatar, AvatarFallback} from "@/components/ui/avatar";
import {signOut} from "@/features/auth/sign-out";
import {OrganizationWithMeta} from "@square-base-db/types";

// ── Org-level nav (only Home) ───────────────────────────────────────────────
const orgNavItem = {icon: Home, label: "Home", segment: "projects"} as const;

// ── Project-level nav ───────────────────────────────────────────────────────
const projectNavItems = [
  {icon: Table2, label: "Database", segment: "database"},
  {icon: TerminalSquare, label: "SQL (Query)", segment: "sql"},
  {icon: ShieldCheck, label: "Auth", segment: "auth"},
  {icon: FolderOpen, label: "Storage", segment: "storage"},
  {icon: Code2, label: "API", segment: "api"},
  {icon: Radio, label: "Realtime", segment: "realtime"},
] as const;

/**
 * Builds the correct href depending on scope.
 * - org scope  → /organizations/:orgSlug/projects
 * - project scope → /organizations/:orgSlug/:projectSlug/:segment
 */
function buildNavHref(
  orgSlug: string | undefined,
  projectSlug: string | undefined,
  segment: string,
  scope: "org" | "project",
): string {
  if (!orgSlug) return "/organizations";

  if (scope === "org") {
    return `/organizations/${orgSlug}/projects`;
  }

  if (projectSlug) {
    return `/organizations/${orgSlug}/${projectSlug}/${segment}`;
  }

  // Fallback when no project is selected yet
  return `/organizations/${orgSlug}/projects`;
}

/**
 * Checks if a nav item should look active.
 */
function isNavItemActive(
  pathname: string,
  orgSlug: string | undefined,
  projectSlug: string | undefined,
  segment: string,
  scope: "org" | "project",
): boolean {
  if (!orgSlug) return false;

  if (scope === "org") {
    return pathname === `/organizations/${orgSlug}/projects`;
  }

  if (!projectSlug) return false;

  const base = `/organizations/${orgSlug}/${projectSlug}/${segment}`;
  return pathname === base || pathname.startsWith(`${base}/`);
}

interface AppSidebarProps {
  orgs: OrganizationWithMeta[];
  user: { email: string; name: string | null };
}

export function AppSidebar({orgs, user}: AppSidebarProps) {
  const pathname = usePathname();
  // Support both org slug and optional project slug
  const params = useParams<{ slug: string; projectSlug?: string }>();

  const currentOrg = orgs.find((org) => org.slug === params?.slug) ?? orgs[0];
  const orgSlug = params?.slug;
  const projectSlug = params?.projectSlug;

  const homeHref = buildNavHref(orgSlug, projectSlug, orgNavItem.segment, "org");
  const isHomeActive = isNavItemActive(
    pathname,
    orgSlug,
    projectSlug,
    orgNavItem.segment,
    "org",
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
      {/* ── Header — Organization Switcher ────────────────────────── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                nativeButton={true}
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <div
                      className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold">
                      <Building2 className="size-4"/>
                    </div>
                    <div
                      className="grid flex-1 text-left text-sm leading-tight truncate">
                      <span
                        className="truncate font-semibold text-sidebar-foreground">
                        {currentOrg?.name ?? "Select Org"}
                      </span>
                      <span
                        className="truncate text-xs text-muted-foreground capitalize">
                        {currentOrg?.role ?? "Member"}
                      </span>
                    </div>
                    <ChevronsUpDown
                      className="ml-auto size-4 text-muted-foreground"/>
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg border-border"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel
                    className="text-xs font-semibold text-muted-foreground">
                    Organizations
                  </DropdownMenuLabel>
                </DropdownMenuGroup>

                {orgs.map((org) => {
                  const isSelected = org.slug === currentOrg?.slug;
                  return (
                    <DropdownMenuItem
                      key={org.id}
                      nativeButton={false}
                      render={
                        <Link
                          href={`/organizations/${org.slug}/projects`}
                          className="flex items-center justify-between w-full cursor-pointer"
                        >
                          <span className="truncate">{org.name}</span>
                          {isSelected && (
                            <Check className="ml-auto size-4 text-primary"/>
                          )}
                        </Link>
                      }
                    />
                  );
                })}

                <DropdownMenuSeparator/>

                <DropdownMenuItem
                  nativeButton={false}
                  render={
                    <Link
                      href="/organizations"
                      className="flex items-center gap-2 w-full cursor-pointer"
                    >
                      <span>All organizations</span>
                    </Link>
                  }
                />
                <DropdownMenuItem
                  nativeButton={false}
                  render={
                    <Link
                      href="/organizations/new"
                      className="flex items-center gap-2 w-full cursor-pointer font-medium text-primary"
                    >
                      <Plus className="size-4"/>
                      <span>New organization</span>
                    </Link>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Content — Navigation Menu ─────────────────────────────── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel
            className="text-xs uppercase font-medium text-muted-foreground tracking-wider px-2">
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Home (org-level) */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isHomeActive}
                  tooltip={orgNavItem.label}
                  {...({} as { nativebutton: "false" })}
                  render={
                    <Link href={homeHref} className="flex items-center gap-3">
                      <orgNavItem.icon className="size-4"/>
                      <span className="font-medium text-sm">
                        {orgNavItem.label}
                      </span>
                    </Link>
                  }
                />
              </SidebarMenuItem>

              {/* Separator between org-level and project-level nav */}
              <SidebarSeparator
                className="my-2 group-data-[collapsible=icon]:hidden"/>

              {/* Project-level items */}
              {projectNavItems.map(({icon: Icon, label, segment}) => {
                const href = buildNavHref(
                  orgSlug,
                  projectSlug,
                  segment,
                  "project",
                );
                const isActive = isNavItemActive(
                  pathname,
                  orgSlug,
                  projectSlug,
                  segment,
                  "project",
                );

                return (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={label}
                      {...({} as { nativebutton: "false" })}
                      render={
                        <Link href={href} className="flex items-center gap-3">
                          <Icon className="size-4"/>
                          <span className="font-medium text-sm">{label}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer — User Settings & Profile ──────────────────────── */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                nativeButton={true}
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-8 rounded-lg border border-border">
                      <AvatarFallback
                        className="rounded-lg bg-muted text-foreground font-semibold text-xs">
                        {(user.name ?? user.email).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className="grid flex-1 text-left text-sm leading-tight truncate">
                      <span
                        className="truncate font-semibold text-sidebar-foreground">
                        {user.name ?? "Account"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                    <ChevronsUpDown
                      className="ml-auto size-4 text-muted-foreground"/>
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg border-border"
                side="top"
                align="start"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div
                      className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar
                        className="size-8 rounded-lg border border-border">
                        <AvatarFallback
                          className="rounded-lg bg-muted text-foreground font-semibold text-xs">
                          {(user.name ?? user.email).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className="grid flex-1 text-left text-sm leading-tight truncate">
                        <span className="truncate font-semibold">
                          {user.name ?? "Account"}
                        </span>
                        <span
                          className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>

                <DropdownMenuSeparator/>

                <DropdownMenuItem
                  nativeButton={false}
                  render={
                    <Link
                      href={`/organizations/${orgSlug ?? currentOrg?.slug}/settings/members`}
                      className="flex items-center gap-2 w-full cursor-pointer"
                    >
                      <Settings className="size-4"/>
                      <span>Settings</span>
                    </Link>
                  }
                />

                <DropdownMenuSeparator/>

                <DropdownMenuItem
                  nativeButton={false}
                  onSelect={(event) => event.preventDefault()}
                  render={
                    <form action={signOut} className="w-full">
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2 text-destructive hover:text-destructive text-sm font-medium cursor-pointer"
                      >
                        <LogOut className="size-4"/>
                        <span>Sign out</span>
                      </button>
                    </form>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail/>
    </Sidebar>
  );
}