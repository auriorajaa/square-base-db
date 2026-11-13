"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type State =
  | { kind: "checking" }
  | { kind: "ok"; status: string; ms: number }
  | { kind: "degraded"; status: string; ms: number }
  | { kind: "down" };

// Values of `status` from GET /health that count as healthy.
const HEALTHY = new Set(["ok", "healthy", "up", "operational"]);

const DOT = {
  checking: "bg-muted-foreground animate-pulse motion-reduce:animate-none",
  ok: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-rose-500",
} as const;

export function ApiStatus({ className }: { className?: string }) {
  const [state, setState] = useState<State>({ kind: "checking" });
  // Bumped by the re-check button to re-run the effect below.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const started = performance.now();
    let cancelled = false;

    // setState only happens inside the promise callbacks (never synchronously
    // in the effect body), and `cancelled` ignores stale responses on
    // unmount, re-check, and React Strict Mode's double invoke.
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ status?: string }>;
      })
      .then((data) => {
        if (cancelled) return;
        const status = String(data.status ?? "unknown");
        setState({
          kind: HEALTHY.has(status.toLowerCase()) ? "ok" : "degraded",
          status,
          ms: Math.round(performance.now() - started),
        });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "down" });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function recheck() {
    setState({ kind: "checking" });
    setAttempt((n) => n + 1);
  }

  const label =
    state.kind === "checking"
      ? "Checking API..."
      : state.kind === "ok"
        ? "API operational"
        : state.kind === "degraded"
          ? `API status: ${state.status}`
          : "API unreachable";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2", className)}
    >
      <span className={cn("size-2 shrink-0 rounded-full", DOT[state.kind])} />
      <span>{label}</span>
      {(state.kind === "ok" || state.kind === "degraded") && (
        <span className="font-mono text-xs">{state.ms} ms</span>
      )}
      <button
        type="button"
        onClick={recheck}
        disabled={state.kind === "checking"}
        aria-label="Re-check API status"
        className="rounded p-1 transition-colors hover:text-foreground disabled:opacity-40"
      >
        <RefreshCw
          className={cn(
            "size-3.5",
            state.kind === "checking" &&
              "animate-spin motion-reduce:animate-none",
          )}
        />
      </button>
    </div>
  );
}
