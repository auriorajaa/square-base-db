"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {io, Socket} from "socket.io-client";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  Copy,
  Info,
  Pause,
  Play,
  Radio,
  Table2,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Switch} from "@/components/ui/switch";
import {cn} from "@/lib/utils";
import {REALTIME_EVENTS} from "@square-base-db/constants";
import type {RealtimeEvent} from "@square-base-db/types";

interface RealtimeClientProps {
  orgSlug: string;
  projectSlug: string;
  projectId: string;
  anonKey: string;
  tables: string[];
}

type FeedEvent = RealtimeEvent & { id: string };

const EVENT_TYPES = ["INSERT", "UPDATE", "DELETE"] as const;
type EventType = (typeof EVENT_TYPES)[number];
type EventFilter = "ALL" | EventType;

const MAX_EVENTS = 100;

const EVENT_STYLES: Record<EventType, string> = {
  INSERT:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  UPDATE:
    "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  DELETE:
    "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const FALLBACK_EVENT_STYLE = "border-border bg-muted text-foreground";

const INITIAL_STATS = {total: 0, INSERT: 0, UPDATE: 0, DELETE: 0};

function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";
}

function getRealtimeSocketBaseUrl(): string {
  // WebSocket namespace is NOT under /api
  return getApiUrl().replace(/\/api\/?$/, "");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getChangedKeys(
  record: Record<string, unknown> | null,
  oldRecord: Record<string, unknown> | null,
): string[] {
  if (!record || !oldRecord) return [];
  const keys = Array.from(
    new Set([...Object.keys(record), ...Object.keys(oldRecord)]),
  );
  return keys.filter(
    (key) => JSON.stringify(record[key]) !== JSON.stringify(oldRecord[key]),
  );
}

function formatTime(value: number | string | Date): string {
  const d = new Date(value);
  const base = d.toLocaleTimeString([], {hour12: false});
  return `${base}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

export function RealtimeClient({
                                 orgSlug,
                                 projectSlug,
                                 projectId,
                                 anonKey,
                                 tables,
                               }: RealtimeClientProps) {
  const socketUrl = `${getRealtimeSocketBaseUrl()}/realtime`;

  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [transport, setTransport] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [subscribedTables, setSubscribedTables] = useState<Set<string>>(
    new Set(),
  );
  const [pendingTables, setPendingTables] = useState<Set<string>>(new Set());

  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [missed, setMissed] = useState(0);
  const [filter, setFilter] = useState<EventFilter>("ALL");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const pausedRef = useRef(false);
  const nextEventId = useRef(0);

  useEffect(() => {
    subscribedRef.current = subscribedTables;
  }, [subscribedTables]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const socket = io(socketUrl, {
      auth: {token: anonKey},
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setConnected(true);
      setConnectionError(null);
      setSocketId(socket.id ?? null);
      setTransport(socket.io.engine.transport.name);
      socket.io.engine.on("upgrade", (t: { name: string }) =>
        setTransport(t.name),
      );

      // re-subscribe after reconnect
      for (const tableName of subscribedRef.current) {
        socket.emit(REALTIME_EVENTS.SUBSCRIBE, tableName);
      }
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setSocketId(null);
      setTransport(null);
    });

    socket.on("connect_error", (err: Error) => {
      setConnected(false);
      setConnectionError(err.message);
    });

    socket.on(REALTIME_EVENTS.ERROR, (msg: string) => {
      console.error("Realtime error:", msg);
      setConnected(false);
      setConnectionError(typeof msg === "string" ? msg : "Realtime error");
    });

    socket.on(REALTIME_EVENTS.EVENT, (event: RealtimeEvent) => {
      const type = String(event.type);

      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        ...(isEventType(type) ? {[type]: prev[type] + 1} : {}),
      }));
      setLastEventAt(Date.now());

      if (pausedRef.current) {
        setMissed((m) => m + 1);
        return;
      }

      const id = `evt-${nextEventId.current++}`;
      setEvents((prev) => [{...event, id}, ...prev.slice(0, MAX_EVENTS - 1)]);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [anonKey, socketUrl]);

  const toggleTable = useCallback(
    async (tableName: string, enabled: boolean) => {
      const socket = socketRef.current;
      if (!socket) return;

      const apiUrl = getApiUrl();
      const base = `${apiUrl}/orgs/${orgSlug}/projects/${projectSlug}/realtime/${tableName}`;

      setActionError(null);
      setPendingTables((prev) => new Set(prev).add(tableName));

      try {
        if (enabled) {
          const res = await fetch(`${base}/enable`, {
            method: "POST",
            credentials: "include",
          });

          if (!res.ok) {
            throw new Error(
              `Could not enable realtime for "${tableName}" (HTTP ${res.status}).`,
            );
          }

          socket.emit(REALTIME_EVENTS.SUBSCRIBE, tableName);
          setSubscribedTables((prev) => new Set(prev).add(tableName));
        } else {
          socket.emit(REALTIME_EVENTS.UNSUBSCRIBE, tableName);
          setSubscribedTables((prev) => {
            const next = new Set(prev);
            next.delete(tableName);
            return next;
          });

          const res = await fetch(`${base}/disable`, {
            method: "DELETE",
            credentials: "include",
          });

          if (!res.ok) {
            throw new Error(
              `Could not disable realtime for "${tableName}" (HTTP ${res.status}).`,
            );
          }
        }
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      } finally {
        setPendingTables((prev) => {
          const next = new Set(prev);
          next.delete(tableName);
          return next;
        });
      }
    },
    [orgSlug, projectSlug],
  );

  const setAllTables = useCallback(
    async (enabled: boolean) => {
      const targets = tables.filter(
        (t) => subscribedRef.current.has(t) !== enabled,
      );
      await Promise.all(targets.map((t) => toggleTable(t, enabled)));
    },
    [tables, toggleTable],
  );

  const copyToClipboard = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 2000);
    } catch {
      // clipboard may be unavailable (e.g. insecure context)
    }
  }, []);

  const togglePaused = () => {
    setPaused((p) => !p);
    setMissed(0);
  };

  const clearFeed = () => {
    setEvents([]);
    setMissed(0);
  };

  const bufferCounts = useMemo(() => {
    const counts: Record<EventFilter, number> = {
      ALL: events.length,
      INSERT: 0,
      UPDATE: 0,
      DELETE: 0,
    };
    for (const e of events) {
      const t = String(e.type);
      if (isEventType(t)) counts[t]++;
    }
    return counts;
  }, [events]);

  const filteredEvents = useMemo(
    () =>
      filter === "ALL"
        ? events
        : events.filter((e) => String(e.type) === filter),
    [events, filter],
  );

  const allEnabled = tables.length > 0 && subscribedTables.size === tables.length;
  const noneEnabled = subscribedTables.size === 0;

  const snippet = `import { io } from "socket.io-client";

const socket = io("${socketUrl}", {
  auth: { token: "<ANON_KEY>" },
});

socket.emit("${REALTIME_EVENTS.SUBSCRIBE}", "your_table");

socket.on("${REALTIME_EVENTS.EVENT}", (event) => {
  console.log(event.type, event.table, event.record);
});`;

  return (
    <div className="mx-auto w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Realtime
          </h1>
          <p className="text-sm text-muted-foreground">
            Subscribe to table changes and watch INSERT, UPDATE and DELETE
            events stream in live over Socket.IO.
          </p>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 self-start px-2.5 py-1 text-xs font-medium",
            connected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full",
              connected ? "animate-pulse bg-emerald-500" : "bg-rose-500",
            )}
          />
          {connected ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      {/* Errors */}
      {(connectionError || actionError) && (
        <div className="space-y-2">
          {connectionError && (
            <div
              className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0"/>
              <span className="min-w-0 break-words">
                Connection problem: {connectionError}. Socket.IO will keep
                retrying automatically.
              </span>
            </div>
          )}
          {actionError && (
            <div
              className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0"/>
              <span className="min-w-0 break-words">{actionError}</span>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={connected ? Wifi : WifiOff}
          iconClassName={connected ? "text-emerald-500" : "text-rose-500"}
          label="Status"
          value={connected ? "Connected" : "Disconnected"}
          hint={transport ? `via ${transport}` : "Waiting for connection"}
        />
        <StatCard
          icon={Radio}
          label="Listening"
          value={`${subscribedTables.size} / ${tables.length}`}
          hint={tables.length === 1 ? "table subscribed" : "tables subscribed"}
        />
        <StatCard
          icon={Activity}
          label="Events received"
          value={String(stats.total)}
          hint={`${stats.INSERT} ins · ${stats.UPDATE} upd · ${stats.DELETE} del`}
        />
        <StatCard
          icon={Clock}
          label="Last event"
          value={lastEventAt ? formatTime(lastEventAt) : "—"}
          hint={paused ? "Feed paused" : "This session"}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        {/* Left column: tables + connection */}
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
          {/* Tables */}
          <Card className="gap-0 rounded-xl border border-border bg-card py-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Table2 className="size-4 text-muted-foreground"/>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tables
                </h2>
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {tables.length}
                </Badge>
              </div>

              {tables.length > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={!connected || allEnabled}
                    onClick={() => void setAllTables(true)}
                  >
                    Enable all
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={!connected || noneEnabled}
                    onClick={() => void setAllTables(false)}
                  >
                    Disable all
                  </Button>
                </div>
              )}
            </div>

            <CardContent className="p-4">
              {tables.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <Table2 className="mb-2 size-6 text-muted-foreground"/>
                  <p className="text-sm font-medium text-foreground">
                    No tables yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create one in the Table Editor to start listening.
                  </p>
                </div>
              ) : (
                <div className="max-h-[420px] space-y-2 overflow-y-auto">
                  {tables.map((table) => {
                    const on = subscribedTables.has(table);
                    const pending = pendingTables.has(table);

                    return (
                      <div
                        key={table}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors",
                          on
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-border bg-muted/20",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Table2 className="size-4 shrink-0 text-muted-foreground"/>
                          <span className="truncate font-mono text-sm text-foreground">
                            {table}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={cn(
                              "text-xs font-medium",
                              on
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground",
                            )}
                          >
                            {pending ? "Updating…" : on ? "Listening" : "Off"}
                          </span>
                          <Switch
                            aria-label={`Listen to ${table}`}
                            checked={on}
                            onCheckedChange={(checked) => void toggleTable(table, checked)}
                            disabled={!connected || pending}
                            className="data-[state=unchecked]:bg-neutral-300 data-[unchecked]:bg-neutral-300 dark:data-[state=unchecked]:bg-neutral-600 dark:data-[unchecked]:bg-neutral-600"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Connection details */}
          <Card className="gap-0 rounded-xl border border-border bg-card py-0">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <Info className="size-4 text-muted-foreground"/>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Connection details
              </h2>
            </div>
            <CardContent className="space-y-3 p-4">
              <InfoRow label="Endpoint" value={socketUrl}/>
              <InfoRow label="Project ID" value={projectId}/>
              <InfoRow label="Auth" value="Anon key (handshake token)"/>
              <InfoRow label="Transport" value={transport ?? "—"}/>
              <InfoRow label="Socket ID" value={socketId ?? "—"}/>
            </CardContent>
          </Card>
        </div>

        {/* Right column: event feed */}
        <Card className="gap-0 overflow-hidden rounded-xl border border-border bg-card py-0 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-muted-foreground"/>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Event feed
              </h2>
              <Badge variant="secondary" className="text-[10px] font-normal">
                {events.length}
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={togglePaused}
              >
                {paused ? (
                  <Play className="size-3.5"/>
                ) : (
                  <Pause className="size-3.5"/>
                )}
                {paused ? "Resume" : "Pause"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground"
                onClick={clearFeed}
                disabled={events.length === 0}
              >
                <Trash2 className="size-3.5"/>
                Clear
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2.5">
            {(["ALL", ...EVENT_TYPES] as EventFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium capitalize transition-colors",
                  filter === f
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {f.toLowerCase()}
                <span className="font-mono text-[10px] text-muted-foreground">
                  {bufferCounts[f]}
                </span>
              </button>
            ))}
          </div>

          {paused && (
            <div
              className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Pause className="size-3.5 shrink-0"/>
              <span>
                Feed paused
                {missed > 0
                  ? ` — ${missed} new ${missed === 1 ? "event" : "events"} not shown`
                  : ""}
                . Resume to see new events.
              </span>
            </div>
          )}

          {/* Feed body */}
          {subscribedTables.size === 0 && events.length === 0 ? (
            <EmptyState
              icon={<Radio className="size-6 text-muted-foreground"/>}
              title="Toggle a table to start listening"
              description="Events will appear here in real time."
            />
          ) : events.length === 0 ? (
            <EmptyState
              icon={
                <div className="flex gap-1">
                  {[0, 150, 300].map((delay) => (
                    <div
                      key={delay}
                      className="size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"
                      style={{animationDelay: `${delay}ms`}}
                    />
                  ))}
                </div>
              }
              title="Listening for changes…"
              description="Insert, update, or delete a row to see an event."
            />
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              icon={<Zap className="size-6 text-muted-foreground"/>}
              title={`No ${filter.toLowerCase()} events in the feed`}
              description="Switch the filter to see other event types."
            />
          ) : (
            <div className="max-h-[60vh] min-h-72 divide-y divide-border overflow-y-auto">
              {filteredEvents.map((event) => (
                <EventItem
                  key={event.id}
                  event={event}
                  copied={copiedKey === event.id}
                  onCopy={copyToClipboard}
                />
              ))}
            </div>
          )}

          <div className="border-t border-border bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
            Showing the latest {MAX_EVENTS} events. The feed lives in memory
            only and resets on page refresh.
          </div>
        </Card>
      </div>

      {/* Docs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="gap-0 rounded-xl border border-border bg-card py-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
            <div className="flex items-center gap-2">
              <Code2 className="size-4 text-primary"/>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Connect from your app
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs font-medium"
              onClick={() => void copyToClipboard(snippet, "snippet")}
            >
              {copiedKey === "snippet" ? (
                <>
                  <Check className="size-3 text-emerald-500"/>
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3"/>
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
          <CardContent className="space-y-2 p-4">
            <pre
              className="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground">
              {snippet}
            </pre>
            <p className="text-xs text-muted-foreground">
              Replace <span className="font-mono text-foreground">
              &lt;ANON_KEY&gt;</span> with your project&apos;s anon key from the
              API page. Use a client-safe key only.
            </p>
          </CardContent>
        </Card>

        <Card className="gap-0 rounded-xl border border-border bg-card py-0">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <Info className="size-4 text-muted-foreground"/>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Event payload & notes
            </h2>
          </div>
          <CardContent className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                {field: "type", desc: "INSERT, UPDATE or DELETE"},
                {field: "table", desc: "Table the change happened on"},
                {field: "record", desc: "Row data for the change"},
                {field: "oldRecord", desc: "Previous values, when available"},
                {field: "timestamp", desc: "When the event was emitted"},
              ].map((item) => (
                <div
                  key={item.field}
                  className="space-y-0.5 rounded-lg border border-border bg-muted/20 p-2.5"
                >
                  <span className="font-mono text-xs font-bold text-primary">
                    {item.field}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
              <li>
                Switching a table on or off also calls the project&apos;s
                enable/disable endpoint, not just this browser session.
              </li>
              <li>
                Subscriptions are re-sent automatically if the socket
                reconnects.
              </li>
              <li>
                For UPDATE events, the feed highlights which columns changed.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
                    icon: Icon,
                    iconClassName,
                    label,
                    value,
                    hint,
                  }: {
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="gap-0 rounded-xl border border-border bg-card py-0">
      <CardContent className="space-y-1 p-3.5 sm:p-4">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("size-3.5 text-muted-foreground", iconClassName)}/>
          <span className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        <p className="truncate font-mono text-base font-semibold text-foreground sm:text-lg">
          {value}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({label, value}: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="break-all font-mono text-xs text-foreground">{value}</p>
    </div>
  );
}

function EmptyState({
                      icon,
                      title,
                      description,
                    }: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-3">{icon}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function EventItem({
                     event,
                     copied,
                     onCopy,
                   }: {
  event: FeedEvent;
  copied: boolean;
  onCopy: (text: string, key: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);

  const type = String(event.type);
  const record = asRecord(event.record);
  const oldRecord = asRecord(event.oldRecord);
  const changed = type === "UPDATE" ? getChangedKeys(record, oldRecord) : [];
  const preview = JSON.stringify(event.record) ?? "";
  const style = isEventType(type) ? EVENT_STYLES[type] : FALLBACK_EVENT_STYLE;

  const fullJson = JSON.stringify(
    {
      type: event.type,
      table: event.table,
      record: event.record,
      oldRecord: event.oldRecord,
      timestamp: event.timestamp,
    },
    null,
    2,
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge
              variant="outline"
              className={cn("font-mono text-[11px] font-bold", style)}
            >
              {type}
            </Badge>
            <span className="truncate font-mono text-sm text-foreground">
              {event.table}
            </span>
          </div>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {preview}
          </p>
          {changed.length > 0 && (
            <p className="truncate text-[11px] text-muted-foreground">
              changed:{" "}
              <span className="font-mono text-foreground">
                {changed.join(", ")}
              </span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
          <span className="font-mono">{formatTime(event.timestamp)}</span>
          {expanded ? (
            <ChevronUp className="size-4"/>
          ) : (
            <ChevronDown className="size-4"/>
          )}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Payload
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs font-medium"
              onClick={() => void onCopy(fullJson, event.id)}
            >
              {copied ? (
                <>
                  <Check className="size-3 text-emerald-500"/>
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3"/>
                  <span>Copy JSON</span>
                </>
              )}
            </Button>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Record
            </p>
            <pre
              className="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground">
              {JSON.stringify(event.record, null, 2)}
            </pre>
          </div>

          {event.oldRecord && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Previous record
              </p>
              <pre
                className="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs text-muted-foreground">
                {JSON.stringify(event.oldRecord, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}