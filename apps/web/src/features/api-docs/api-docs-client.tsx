"use client";

import {useState} from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Eye,
  EyeOff,
  Globe,
  HelpCircle,
  Key,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Card, CardContent, CardDescription, CardHeader, CardTitle,} from "@/components/ui/card";
import {cn} from "@/lib/utils";
import type {ProjectApiDocs} from "@square-base-db/types";

export function ApiDocsClient({docs}: { docs: ProjectApiDocs }) {
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [showServiceKey, setShowServiceKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Interactive feature: Use real keys inside cURL code snippets when enabled
  const [useRealKeysInSnippets, setUseRealKeysInSnippets] = useState(false);

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const methodBadges: Record<string, string> = {
    GET: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    POST: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    PATCH: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    DELETE: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  };

  return (
    <div className="mx-auto w-full space-y-8">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          API Documentation & Reference
        </h1>
        <p className="text-sm text-muted-foreground">
          Auto-generated RESTful endpoints, API keys, and query operators for your database tables.
        </p>
      </div>

      {/* API Keys Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="size-4 text-muted-foreground"/>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              API Keys & Authentication
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setUseRealKeysInSnippets((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <Code2 className="size-3.5 text-primary"/>
            <span>
              {useRealKeysInSnippets ? "Hide real keys in examples" : "Show real keys in examples"}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Anon Key Card */}
          <Card className="border border-border bg-card rounded-xl">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-500"/>
                  <CardTitle className="text-sm font-semibold">Anon Public Key</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[10px] uppercase font-normal">
                  Public / Client
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Safe for frontend applications (React, Next.js client side). Grants read-only access by default.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
                <code className="min-w-0 truncate font-mono text-xs text-foreground">
                  {showAnonKey ? docs.anonKey : "••••••••••••••••••••••••••••••••••••••••"}
                </code>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAnonKey((v) => !v)}
                  >
                    {showAnonKey ? <EyeOff className="size-3.5"/> : <Eye className="size-3.5"/>}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => void copyToClipboard(docs.anonKey, "anon")}
                  >
                    {copiedKey === "anon" ? (
                      <Check className="size-3.5 text-emerald-500"/>
                    ) : (
                      <Copy className="size-3.5"/>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Role Key Card */}
          <Card className="border border-border bg-card rounded-xl">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="size-4 text-rose-500"/>
                  <CardTitle className="text-sm font-semibold">Service Role Key</CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className="border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] uppercase font-normal"
                >
                  Secret / Server Only
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Full administrative access (bypasses policies). Never expose this key in client-side code.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
                <code className="min-w-0 truncate font-mono text-xs text-foreground">
                  {showServiceKey
                    ? docs.serviceRoleKey
                    : "••••••••••••••••••••••••••••••••••••••••"}
                </code>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowServiceKey((v) => !v)}
                  >
                    {showServiceKey ? <EyeOff className="size-3.5"/> : <Eye className="size-3.5"/>}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      void copyToClipboard(docs.serviceRoleKey, "service")
                    }
                  >
                    {copiedKey === "service" ? (
                      <Check className="size-3.5 text-emerald-500"/>
                    ) : (
                      <Copy className="size-3.5"/>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Project URL Banner */}
        <Card className="border border-border bg-card rounded-xl">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Globe className="size-3.5 text-muted-foreground"/>
                  <span className="text-xs font-medium text-muted-foreground">
                    REST API Base Endpoint
                  </span>
                </div>
                <code className="block truncate font-mono text-xs sm:text-sm text-foreground">
                  {docs.projectUrl}/rest
                </code>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium self-start sm:self-center shrink-0"
                onClick={() => void copyToClipboard(`${docs.projectUrl}/rest`, "url")}
              >
                {copiedKey === "url" ? (
                  <>
                    <Check className="size-3.5 text-emerald-500"/>
                    <span>Copied Base URL</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5"/>
                    <span>Copy Base URL</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtering Cheat Sheet */}
      <QueryOperatorsGuide/>

      {/* Endpoints List */}
      {docs.tables.length === 0 ? (
        <Card className="border border-dashed border-border bg-card rounded-xl py-16">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Terminal className="size-8 text-muted-foreground mb-3"/>
            <p className="text-sm font-semibold text-foreground">No endpoints generated</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Create a table in the Table Editor to automatically generate REST endpoints.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-muted-foreground"/>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Table Endpoints
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {docs.tables.length} {docs.tables.length === 1 ? "table" : "tables"} available
            </span>
          </div>

          <div className="space-y-8">
            {docs.tables.map((table) => (
              <div key={table.name} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-foreground font-mono">
                    {table.name}
                  </h3>
                  <Badge variant="outline" className="text-xs font-mono font-normal">
                    {table.endpoints.length} endpoints
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {table.endpoints.map((endpoint, i) => (
                    <EndpointCard
                      key={`${endpoint.method}-${endpoint.path}-${i}`}
                      endpoint={endpoint}
                      methodBadges={methodBadges}
                      onCopy={copyToClipboard}
                      copiedKey={copiedKey}
                      anonKey={docs.anonKey}
                      serviceRoleKey={docs.serviceRoleKey}
                      useRealKeys={useRealKeysInSnippets}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

{/* Filter Operators Reference Guide */
}

function QueryOperatorsGuide() {
  const [open, setOpen] = useState(false);

  const operators = [
    {op: "eq", desc: "Equal to", example: "?age=eq.25"},
    {op: "neq", desc: "Not equal to", example: "?status=neq.archived"},
    {op: "gt", desc: "Greater than", example: "?price=gt.100"},
    {op: "gte", desc: "Greater than or equal", example: "?score=gte.80"},
    {op: "lt", desc: "Less than", example: "?stock=lt.10"},
    {op: "lte", desc: "Less than or equal", example: "?discount=lte.50"},
    {op: "like", desc: "Pattern matching (* for wildcards)", example: "?name=like.*John*"},
    {op: "in", desc: "Value in list", example: "?role=in.(admin,user)"},
  ];

  return (
    <Card className="border border-border bg-card rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="size-4 text-primary"/>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            URL Filtering & Operator Reference
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{open ? "Hide guide" : "Show operators guide"}</span>
          {open ? <ChevronUp className="size-4"/> : <ChevronDown className="size-4"/>}
        </div>
      </button>

      {open && (
        <CardContent className="p-4 pt-0 border-t border-border mt-1">
          <p className="text-xs text-muted-foreground py-2">
            Append operators directly to column names in GET query parameters for instant filtering:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
            {operators.map((item) => (
              <div
                key={item.op}
                className="rounded-lg border border-border bg-muted/20 p-2.5 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-primary">
                    {item.op}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {item.desc}
                  </span>
                </div>
                <code
                  className="block font-mono text-[11px] text-foreground truncate bg-background px-1.5 py-0.5 rounded border border-border">
                  {item.example}
                </code>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function EndpointCard({
                        endpoint,
                        methodBadges,
                        onCopy,
                        copiedKey,
                        anonKey,
                        serviceRoleKey,
                        useRealKeys,
                      }: {
  endpoint: {
    method: string;
    path: string;
    description: string;
    example: string;
  };
  methodBadges: Record<string, string>;
  onCopy: (text: string, key: string) => Promise<void>;
  copiedKey: string | null;
  anonKey: string;
  serviceRoleKey: string;
  useRealKeys: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const copyKey = `${endpoint.method}-${endpoint.path}`;

  // Dynamically replace placeholders in example cURL snippets
  const formattedExample = endpoint.example
    .replace("<ANON_KEY>", useRealKeys ? anonKey : "<ANON_KEY>")
    .replace("<SERVICE_ROLE_KEY>", useRealKeys ? serviceRoleKey : "<SERVICE_ROLE_KEY>");

  return (
    <div
      className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border/80"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide shrink-0",
              methodBadges[endpoint.method] ?? "border-border bg-muted text-foreground"
            )}
          >
            {endpoint.method}
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <code className="block truncate font-mono text-xs sm:text-sm font-medium text-foreground">
              {endpoint.path}
            </code>
            <p className="truncate text-xs text-muted-foreground">
              {endpoint.description}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground shrink-0 group-hover:text-foreground"
        >
          {expanded ? <ChevronUp className="size-4"/> : <ChevronDown className="size-4"/>}
        </Button>
      </div>

      {expanded && (
        <div
          className="border-t border-border bg-muted/30 p-3.5 sm:p-4 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Terminal className="size-3.5"/>
              cURL Request Example
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs font-medium gap-1.5"
              onClick={() => void onCopy(formattedExample, copyKey)}
            >
              {copiedKey === copyKey ? (
                <>
                  <Check className="size-3 text-emerald-500"/>
                  <span>Copied Request</span>
                </>
              ) : (
                <>
                  <Copy className="size-3"/>
                  <span>Copy cURL</span>
                </>
              )}
            </Button>
          </div>

          <pre
            className="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground whitespace-pre-wrap break-all leading-relaxed">
            {formattedExample}
          </pre>
        </div>
      )}
    </div>
  );
}