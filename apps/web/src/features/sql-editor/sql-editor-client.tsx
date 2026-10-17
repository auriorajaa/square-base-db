"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Code2,
  History,
  Play,
  Terminal,
  X,
} from "lucide-react";
import type { QueryHistoryItem, QueryResult } from "@square-base-db/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground font-mono">
      Loading SQL editor...
    </div>
  ),
});

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface SqlEditorClientProps {
  orgSlug: string;
  projectSlug: string;
  initialHistory: QueryHistoryItem[];
}

export function SqlEditorClient({
  orgSlug,
  projectSlug,
  initialHistory,
}: SqlEditorClientProps) {
  const [sql, setSql] = useState("SELECT * FROM users LIMIT 10;");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>(initialHistory);
  const [showHistory, setShowHistory] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const runQuery = useCallback(
    async (queryToRun?: string) => {
      const query = queryToRun ?? sql;
      if (!query.trim()) return;

      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/orgs/${orgSlug}/projects/${projectSlug}/sql`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ sql: query }),
          },
        );

        const data = (await res.json()) as QueryResult | { message: string };

        if (!res.ok) {
          setError(
            (data as { message: string }).message ?? "Query execution failed",
          );
          return;
        }

        const queryResult = data as QueryResult;
        setResult(queryResult);

        setHistory((prev) => [
          {
            id: crypto.randomUUID(),
            projectId: projectSlug,
            sql: query,
            executionTimeMs: queryResult.executionTimeMs,
            rowCount: queryResult.rowCount,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      } catch {
        setError("Failed to connect to the SQL runner service");
      } finally {
        setLoading(false);
      }
    },
    [sql, orgSlug, projectSlug],
  );

  const handleEditorMount: OnMount = (editorInstance) => {
    editorRef.current = editorInstance;
    editorInstance.addCommand(2048 | 3, () => void runQuery());
  };

  const EditorPane = (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden bg-card">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Code2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Query Runner
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory((v) => !v)}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <History className="size-3.5" />
            <span>History</span>
          </Button>
          <Button
            size="sm"
            onClick={() => void runQuery()}
            disabled={loading}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Play className="size-3.5 fill-current" />
            <span>{loading ? "Running..." : "Run"}</span>
          </Button>
        </div>
      </div>

      {/* Editor Monaco */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
        <MonacoEditor
          height="100%"
          language="sql"
          value={sql}
          onChange={(v) => setSql(v ?? "")}
          onMount={handleEditorMount}
          theme="vs"
          className="absolute inset-0"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            wordWrap: "on",
          }}
        />
      </div>
    </div>
  );

  const ResultPane = (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden bg-background">
      {result && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 py-2 text-xs">
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
            <span className="truncate font-medium text-foreground">
              {result.command &&
              result.rows.length === 0 &&
              result.command !== "SELECT"
                ? `${result.rowCount} ${result.rowCount === 1 ? "row" : "rows"} affected`
                : `${result.rowCount} ${result.rowCount === 1 ? "row" : "rows"} returned`}
            </span>
            {result.command && (
              <Badge
                variant="outline"
                className="shrink-0 font-mono text-[10px] uppercase"
              >
                {result.command}
              </Badge>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <Clock className="size-3" />
            <span>{result.executionTimeMs} ms</span>
          </div>
        </div>
      )}

      {/* Error Message Header */}
      {error && (
        <div className="flex shrink-0 items-start gap-2.5 border-b border-destructive/20 bg-destructive/10 px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="min-w-0 break-all font-mono text-xs leading-relaxed text-destructive">
            {error}
          </p>
        </div>
      )}

      {/* State Kosong */}
      {!result && !error && (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <Terminal className="mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">
            No query results to display
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Write your SQL query in the editor and click{" "}
            <span className="font-medium text-foreground">Run</span> to execute.
          </p>
        </div>
      )}

      {/* State 0 Rows Returned */}
      {result && result.rows.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-medium text-foreground">
            Query executed successfully
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            0 rows returned.
          </p>
        </div>
      )}

      {result && result.rows.length > 0 && (
        <div className="min-h-0 min-w-0 w-full max-w-full flex-1 overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {result.columns.map((col, idx) => (
                  <th
                    key={col}
                    className={`sticky top-0 z-10 whitespace-nowrap border-b border-r border-border bg-card py-2 text-left text-xs font-semibold text-foreground ${
                      idx === 0 ? "pl-4 pr-3" : "px-3"
                    } ${idx === result.columns.length - 1 ? "pr-6 border-r-0" : ""}`}
                  >
                    <span className="block max-w-xs truncate" title={col}>
                      {col}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/40">
                  {result.columns.map((col, idx) => {
                    const value = formatCellValue(row[col]);

                    return (
                      <td
                        key={col}
                        title={value}
                        className={`whitespace-nowrap border-b border-r border-border/60 py-2 font-mono text-xs ${
                          idx === 0 ? "pl-4 pr-3" : "px-3"
                        } ${idx === result.columns.length - 1 ? "pr-6 border-r-0" : ""}`}
                      >
                        {row[col] === null ? (
                          <span className="italic text-muted-foreground">
                            null
                          </span>
                        ) : (
                          <span className="block max-w-xs truncate">
                            {value}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 max-w-full overflow-hidden rounded-xl bg-background [contain:inline-size]">
      {/* Mobile Stacked Layout */}
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col divide-y divide-border lg:hidden">
        <div className="min-h-0 min-w-0 flex-1 basis-1/2">{EditorPane}</div>
        <div className="min-h-0 min-w-0 flex-1 basis-1/2">{ResultPane}</div>
      </div>

      {/* Desktop Resizable Layout */}
      <div className="hidden h-full min-h-0 w-full min-w-0 lg:flex">
        <ResizablePanelGroup
          orientation="vertical"
          className="h-full min-h-0 w-full min-w-0 flex-1"
        >
          <ResizablePanel
            defaultSize={45}
            minSize={25}
            className="min-h-0 min-w-0"
          >
            {EditorPane}
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            defaultSize={55}
            minSize={25}
            className="min-h-0 min-w-0"
          >
            {ResultPane}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* History Slideout Overlay */}
      {showHistory && (
        <div className="absolute inset-y-0 right-0 z-30 flex h-full w-full flex-col border-l border-border bg-card shadow-2xl sm:w-80">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Query History</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setShowHistory(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {history.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No history entries found.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full cursor-pointer space-y-2 p-4 text-left transition-colors hover:bg-muted/40"
                    onClick={() => {
                      setSql(item.sql);
                      setShowHistory(false);
                    }}
                  >
                    <pre className="line-clamp-3 whitespace-pre-wrap break-all rounded border border-border bg-background p-2 font-mono text-xs leading-relaxed text-foreground">
                      {item.sql}
                    </pre>
                    <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                      <span>
                        {item.rowCount} rows &middot; {item.executionTimeMs}ms
                      </span>
                      <span>
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
