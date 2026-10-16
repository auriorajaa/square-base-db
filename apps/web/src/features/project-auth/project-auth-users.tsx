"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Globe,
  Mail,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ProjectAuthUser } from "@square-base-db/types";

type Provider = ProjectAuthUser["provider"];
type ProviderFilter = "all" | Provider;

const PAGE_SIZE = 25;

const FILTERS: { value: ProviderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "email", label: "Email" },
  { value: "google", label: "Google" },
  { value: "github", label: "GitHub" },
];

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function ProviderIcon({ provider }: { provider: Provider }) {
  if (provider === "github") return <GithubIcon className="size-4" />;
  if (provider === "google") {
    return <span className="text-xs font-semibold text-blue-600">G</span>;
  }
  return <Mail className="size-4" />;
}

function providerLabel(provider: Provider) {
  if (provider === "github") return "GitHub";
  if (provider === "google") return "Google";
  return "Email";
}

function providerType(provider: Provider) {
  return provider === "email" ? "Email" : "Social";
}

function formatDate(value: ProjectAuthUser["createdAt"]) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-normal",
        verified
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "text-muted-foreground",
      )}
    >
      {verified ? "Verified" : "Unverified"}
    </Badge>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="gap-0 rounded-xl border border-border bg-card py-0">
      <CardContent className="space-y-1 p-3.5 @lg:p-4">
        <div className="flex items-center gap-1.5">
          <Icon className="size-3.5 text-muted-foreground" />
          <span className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        <p className="truncate font-mono text-lg font-semibold text-foreground">
          {value}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function CopyIdButton({
  copied,
  onCopy,
}: {
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={onCopy}
      aria-label="Copy user ID"
      title="Copy user ID"
    >
      {copied ? (
        <Check className="size-4 text-emerald-500" />
      ) : (
        <Copy className="size-4" />
      )}
    </Button>
  );
}

export function ProjectAuthUsers({ users }: { users: ProjectAuthUser[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProviderFilter>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Newest first
  const sorted = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [users],
  );

  const stats = useMemo(() => {
    const verified = users.filter((u) => u.emailVerified).length;
    const email = users.filter((u) => u.provider === "email").length;
    return {
      total: users.length,
      verified,
      email,
      social: users.length - email,
    };
  }, [users]);

  const providerCounts = useMemo(
    () => ({
      all: users.length,
      email: users.filter((u) => u.provider === "email").length,
      google: users.filter((u) => u.provider === "google").length,
      github: users.filter((u) => u.provider === "github").length,
    }),
    [users],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((u) => {
      if (filter !== "all" && u.provider !== filter) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
      );
    });
  }, [sorted, query, filter]);

  const visible = filtered.slice(0, limit);
  const isFiltering = query.trim() !== "" || filter !== "all";

  const verifiedPct =
    stats.total === 0 ? 0 : Math.round((stats.verified / stats.total) * 100);

  function updateQuery(value: string) {
    setQuery(value);
    setLimit(PAGE_SIZE);
  }

  function updateFilter(value: ProviderFilter) {
    setFilter(value);
    setLimit(PAGE_SIZE);
  }

  function clearFilters() {
    setQuery("");
    setFilter("all");
    setLimit(PAGE_SIZE);
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      // clipboard may be unavailable (e.g. insecure context)
    }
  }

  return (
    <div className="@container mx-auto w-full space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Users
        </h1>
        <p className="text-sm text-muted-foreground">
          End-users who signed up to apps built on this project.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total users"
          value={String(stats.total)}
          hint="Across all providers"
        />
        <StatCard
          icon={ShieldCheck}
          label="Verified"
          value={String(stats.verified)}
          hint={`${verifiedPct}% of users`}
        />
        <StatCard
          icon={Mail}
          label="Email"
          value={String(stats.email)}
          hint="Password or magic link"
        />
        <StatCard
          icon={Globe}
          label="Social"
          value={String(stats.social)}
          hint="Google and GitHub"
        />
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="Search email or user ID"
            className="pl-9 pr-9"
            aria-label="Search users"
          />
          {query && (
            <button
              type="button"
              onClick={() => updateQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => updateFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span className="font-mono text-[10px] text-muted-foreground">
                {providerCounts[f.value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <Card className="gap-0 rounded-xl border border-dashed border-border bg-card py-0">
          <CardContent className="flex flex-col items-center px-4 py-14 text-center">
            <Users className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              {users.length === 0
                ? "No users yet"
                : "No users match your filters"}
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {users.length === 0
                ? "Sign up from the SDK demo to populate this list."
                : "Try a different search term or provider."}
            </p>
            {isFiltering && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tablet / desktop: table */}
          <Card className="hidden gap-0 overflow-hidden rounded-xl border border-border bg-card py-0 @3xl:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="hidden @5xl:table-cell">Type</TableHead>
                  <TableHead>Created at</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {user.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="max-w-48 truncate text-sm font-medium text-foreground @4xl:max-w-72 @6xl:max-w-md">
                            {user.email}
                          </p>
                          <p className="max-w-48 truncate font-mono text-[11px] text-muted-foreground @4xl:max-w-72 @6xl:max-w-md">
                            {user.id}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1.5 text-sm">
                          <ProviderIcon provider={user.provider} />
                          {providerLabel(user.provider)}
                        </span>
                        <VerifiedBadge verified={user.emailVerified} />
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground @5xl:table-cell">
                      {providerType(user.provider)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      <span suppressHydrationWarning>
                        {formatDate(user.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <CopyIdButton
                        copied={copiedId === user.id}
                        onCopy={() => void copyId(user.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: cards */}
          <ul className="space-y-2 @3xl:hidden">
            {visible.map((user) => (
              <li
                key={user.id}
                className="rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="text-xs">
                      {user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {user.email}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {user.id}
                    </p>
                  </div>
                  <CopyIdButton
                    copied={copiedId === user.id}
                    onCopy={() => void copyId(user.id)}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <ProviderIcon provider={user.provider} />
                    {providerLabel(user.provider)}
                  </span>
                  <VerifiedBadge verified={user.emailVerified} />
                  <span suppressHydrationWarning>
                    {formatDate(user.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing {visible.length} of {filtered.length}{" "}
              {filtered.length === 1 ? "user" : "users"}
              {isFiltering ? ` (filtered from ${users.length})` : ""}
            </p>
            {visible.length < filtered.length && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLimit((l) => l + PAGE_SIZE)}
              >
                Show more
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
