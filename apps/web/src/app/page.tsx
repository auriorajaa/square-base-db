import type {Metadata} from "next";
import Link from "next/link";
import {
  Code2,
  Database,
  FolderOpen,
  Radio,
  ShieldCheck,
  Table2,
  Terminal,
  Users,
} from "lucide-react";
import {BrandLockup} from "@/components/brand-logo";
import {Button} from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {ApiStatus} from "@/features/landing/api-status";
import {cn} from "@/lib/utils";

export const metadata: Metadata = {
  title: "Square Base DB",
  description:
    "A small backend for side projects. Postgres, auth, file storage, realtime, and a REST API in one dashboard.",
};

const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6";

const FEATURES = [
  {
    icon: Table2,
    title: "Database",
    description:
      "Postgres tables with a grid editor for columns, rows, and foreign keys. Every project gets its own schema.",
  },
  {
    icon: ShieldCheck,
    title: "Authentication",
    description:
      "Email and password, magic links, Google, and GitHub. Users show up in the dashboard, not just in a log.",
  },
  {
    icon: FolderOpen,
    title: "Storage",
    description:
      "Public or private buckets. Private files are served through signed URLs that expire.",
  },
  {
    icon: Radio,
    title: "Realtime",
    description:
      "Subscribe to inserts, updates, and deletes on a table. No polling, no cron job pretending to be live.",
  },
  {
    icon: Code2,
    title: "REST API",
    description:
      "Every table becomes an endpoint with eq, gt, like, and ilike filters. Use the anon key in the browser and the service key on the server.",
  },
  {
    icon: Users,
    title: "Teams",
    description:
      "Group projects under an organization and invite people as admins or developers. No shared logins.",
  },
];

const STEPS = [
  {
    title: "Make a project",
    description:
      "Give it a name. Square Base creates a Postgres schema and a set of API keys for it.",
  },
  {
    title: "Build your tables",
    description:
      "Add columns, types, defaults, and foreign keys in the grid. Turn on realtime for the tables that need it.",
  },
  {
    title: "Connect your app",
    description:
      "Install the SDK, point it at your project URL, and use the anon key in the browser. Keep the service key on the server.",
  },
];

const SDK_SNIPPET = `import { createClient } from "square-base-db-js";

const client = createClient(PROJECT_URL, ANON_KEY);

// Query
const { data, error } = await client
  .from("products")
  .select("id, name, price")
  .order("created_at", "desc")
  .limit(10);

// Live updates
const stop = client.realtime.subscribe("products", (event) => {
  console.log(event.type, event.record);
});

// Auth and files
await client.auth.signIn({ email, password });
await client.storage.from("avatars").upload(file);`;

const PREVIEW_ROWS = [
  {id: "1", name: "Desk lamp", price: "24.90", status: "active", updatedAt: "2m ago"},
  {id: "2", name: "Notebook", price: "4.50", status: "active", updatedAt: "12m ago"},
  {id: "3", name: "Standing mat", price: "39.00", status: "active", updatedAt: "1h ago"},
  {id: "4", name: "Cable kit", price: "12.75", status: "draft", updatedAt: "3h ago"},
  {id: "5", name: "Pen holder", price: "8.20", status: "active", updatedAt: "yesterday"},
];

const PREVIEW_TABS = ["Database", "Auth", "Storage", "Realtime"];

function TablePreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md border border-border bg-background">
            <Database className="size-3.5 text-muted-foreground"/>
          </div>
          <span className="truncate text-sm font-medium">storefront</span>
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
            / database
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500"/>
          live
        </span>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto border-b border-border px-4 text-xs sm:gap-5">
        {PREVIEW_TABS.map((tab) => (
          <span
            key={tab}
            className={cn(
              "-mb-px shrink-0 py-2.5",
              tab === "Database"
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <span className="text-xs font-medium">products</span>
        <span className="font-mono text-[11px] text-muted-foreground">5 rows</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-8 px-4 text-[11px] font-medium text-muted-foreground">
              id
            </TableHead>
            <TableHead className="h-8 px-4 text-[11px] font-medium text-muted-foreground">
              name
            </TableHead>
            <TableHead className="h-8 px-4 text-[11px] font-medium text-muted-foreground">
              price
            </TableHead>
            <TableHead className="hidden h-8 px-4 text-[11px] font-medium text-muted-foreground sm:table-cell">
              status
            </TableHead>
            <TableHead className="hidden h-8 px-4 text-right text-[11px] font-medium text-muted-foreground md:table-cell">
              updated
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PREVIEW_ROWS.map((row) => (
            <TableRow key={row.id} className="hover:bg-transparent">
              <TableCell className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
                {row.id}
              </TableCell>
              <TableCell className="px-4 py-2 text-xs">{row.name}</TableCell>
              <TableCell className="px-4 py-2 font-mono text-[11px]">{row.price}</TableCell>
              <TableCell className="hidden px-4 py-2 sm:table-cell">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      row.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40",
                    )}
                  />
                  {row.status}
                </span>
              </TableCell>
              <TableCell className="hidden px-4 py-2 text-right font-mono text-[11px] text-muted-foreground md:table-cell">
                {row.updatedAt}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Radio className="size-3"/>
          Realtime on, products
        </span>
        <span className="font-mono">INSERT · 12s ago</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className={`${CONTAINER} flex h-14 items-center justify-between gap-4`}>
          <BrandLockup href="/"/>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 text-sm text-muted-foreground md:flex"
          >
            <a href="#features" className="transition-colors hover:text-foreground">
              What&apos;s inside
            </a>
            <a href="#getting-started" className="transition-colors hover:text-foreground">
              Getting started
            </a>
            <a href="#note" className="transition-colors hover:text-foreground">
              Note
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              nativeButton={false}
              variant="ghost"
              size="sm"
              render={<Link href="/login">Sign in</Link>}
            />
            <Button
              nativeButton={false}
              size="sm"
              render={<Link href="/organizations">Dashboard</Link>}
            />
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className={`${CONTAINER} grid gap-12 py-14 sm:py-20 lg:grid-cols-[1fr_1.08fr] lg:items-center`}>
          <div className="max-w-xl">

            <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Skip the backend setup.
              <br/>
              Build the app.
            </h1>

            <p className="mt-5 text-base leading-7 text-muted-foreground">
              Square Base is a backend I built for my own projects: Postgres, auth,
              file storage, realtime, and a REST API in one dashboard. Make a
              project, copy two keys, and get back to the part you actually enjoy.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                nativeButton={false}
                size="lg"
                render={<Link href="/register">Create an account</Link>}
              />
              <Button
                nativeButton={false}
                variant="outline"
                size="lg"
                render={<a href="#features">See what&apos;s inside</a>}
              />
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
              .
            </p>
          </div>

          <TablePreview/>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-4 border-t border-border">
          <div className={`${CONTAINER} grid gap-10 py-14 sm:py-20 lg:grid-cols-[280px_1fr]`}>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                01 / What&apos;s inside
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                The pieces you keep rebuilding
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Each project gets its own Postgres schema, keys, and configuration.
                Delete one and the rest keep running.
              </p>
            </div>

            <div className="divide-y divide-border border-y border-border">
              {FEATURES.map((feature, index) => (
                <div
                  key={feature.title}
                  className="grid grid-cols-[1.75rem_1fr] gap-x-3 gap-y-1 py-5"
                >
                  <span className="pt-0.5 font-mono text-xs text-muted-foreground/60">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-medium">
                      <feature.icon className="size-4 text-muted-foreground"/>
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Getting started */}
        <section id="getting-started" className="scroll-mt-4 border-t border-border">
          <div className={`${CONTAINER} grid gap-10 py-14 sm:py-20 lg:grid-cols-[0.9fr_1.1fr]`}>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                02 / Getting started
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                Three steps, then it&apos;s out of the way
              </h2>

              <ol className="mt-8 divide-y divide-border border-y border-border">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="grid grid-cols-[1.75rem_1fr] gap-3 py-5">
                    <span className="pt-0.5 font-mono text-xs text-muted-foreground/60">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-sm font-medium">{step.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="min-w-0">
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    app/products/page.tsx
                  </span>
                  <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    ts
                  </span>
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-6 sm:text-xs">
                  <code>{SDK_SNIPPET}</code>
                </pre>
              </div>

              <div
                className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                <Terminal className="size-3.5 shrink-0"/>
                <span className="truncate">npm install square-base-db-js</span>
              </div>
            </div>
          </div>
        </section>

        {/* Note from the builder */}
        <section id="note" className="scroll-mt-4 border-t border-border">
          <div className={`${CONTAINER} grid gap-8 py-14 sm:py-20 lg:grid-cols-[280px_1fr]`}>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                03 / A note
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                Why this exists
              </h2>
            </div>

            <div className="max-w-2xl space-y-4 text-sm leading-6 text-muted-foreground">
              <p>
                I kept rebuilding the same backend for every project: a users
                table, password reset, uploads, and a socket for updates. Square
                Base is the version I can reuse.
              </p>
              <p>
                It is built and run by one person, so it stays small and
                opinionated. If something is missing or breaks, tell me and
                I&apos;ll fix it.
              </p>
              <p className="pt-1 text-sm font-medium text-foreground">
                Aurio Rajaa{" "}
                <span className="font-normal text-muted-foreground">
                  ·{" "}
                  <a
                    href="https://aurio.work"
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    aurio.work
                  </a>
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Call to action */}
        <section className="border-t border-border">
          <div
            className={`${CONTAINER} grid gap-6 py-14 sm:grid-cols-[1fr_auto] sm:items-end sm:py-16`}>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Start with one project.
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                If it saves you an afternoon, it did its job.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                nativeButton={false}
                render={<Link href="/register">Create an account</Link>}
              />
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link href="/login">Sign in</Link>}
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div
          className={`${CONTAINER} flex flex-col gap-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <BrandLockup
              href="/"
              iconClassName="size-4"
              nameClassName="text-xs font-semibold"
            />
            <span>© {new Date().getFullYear()} Square Base</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://github.com/auriorajaa/square-base-db"
              className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              GitHub
            </a>
            <a
              href="https://aurio.work"
              className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              aurio.work
            </a>
            <ApiStatus/>
          </div>
        </div>
      </footer>
    </div>
  );
}
