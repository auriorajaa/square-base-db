"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProjectOAuthSettings } from "@square-base-db/types";

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

type ProviderId = "email" | "google" | "github";
type OAuthProviderId = Exclude<ProviderId, "email">;

type SaveStatus = {
  state: "idle" | "saving" | "saved" | "error";
  message?: string;
};

const IDLE: SaveStatus = { state: "idle" };

const OAUTH_FIELDS = {
  google: { id: "googleClientId", secret: "googleClientSecret" },
  github: { id: "githubClientId", secret: "githubClientSecret" },
} as const satisfies Record<
  OAuthProviderId,
  { id: keyof ProjectOAuthSettings; secret: keyof ProjectOAuthSettings }
>;

const OAUTH_META: Record<
  OAuthProviderId,
  { name: string; consoleUrl: string; consoleLabel: string }
> = {
  google: {
    name: "Google",
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
    consoleLabel: "Google Cloud Console",
  },
  github: {
    name: "GitHub",
    consoleUrl: "https://github.com/settings/developers",
    consoleLabel: "GitHub Developer Settings",
  },
};

const PROVIDERS: {
  id: ProviderId;
  name: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "email",
    name: "Email",
    description: "Email + password and magic link",
    icon: <Mail className="size-5" />,
  },
  {
    id: "google",
    name: "Google",
    description: "Sign in with a Google account",
    icon: <span className="text-base font-semibold text-blue-600">G</span>,
  },
  {
    id: "github",
    name: "GitHub",
    description: "Sign in with a GitHub account",
    icon: <GithubIcon className="size-5" />,
  },
];

const EMAIL_METHODS = [
  {
    title: "Email + password",
    description: "Users sign up and sign in with an email and a password.",
  },
  {
    title: "Magic link",
    description: "Users receive a sign-in link by email, no password needed.",
  },
];

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join(", ");
    if (data.message) return data.message;
  } catch {
    // body wasn't JSON, fall through to the generic message
  }
  return `${fallback} (HTTP ${res.status})`;
}

export function ProjectAuthProviders({
  orgSlug,
  projectSlug,
  initialSettings,
}: {
  orgSlug: string;
  projectSlug: string;
  initialSettings: ProjectOAuthSettings;
}) {
  // `settings` holds what's typed in the forms, `savedSettings` what the server has.
  const [settings, setSettings] =
    useState<ProjectOAuthSettings>(initialSettings);
  const [savedSettings, setSavedSettings] =
    useState<ProjectOAuthSettings>(initialSettings);
  const [selected, setSelected] = useState<ProviderId | null>(null);
  const [status, setStatus] = useState<Record<OAuthProviderId, SaveStatus>>({
    google: IDLE,
    github: IDLE,
  });
  const [revealed, setRevealed] = useState<Record<OAuthProviderId, boolean>>({
    google: false,
    github: false,
  });
  const [providerToRemove, setProviderToRemove] =
    useState<OAuthProviderId | null>(null);

  const isConfigured = (id: ProviderId, source: ProjectOAuthSettings) =>
    id === "email" ? true : Boolean(source[OAUTH_FIELDS[id].id]);

  const isDirty = (id: OAuthProviderId) => {
    const f = OAUTH_FIELDS[id];
    return (
      (settings[f.id] ?? "") !== (savedSettings[f.id] ?? "") ||
      (settings[f.secret] ?? "") !== (savedSettings[f.secret] ?? "")
    );
  };

  const enabledCount = PROVIDERS.filter((p) =>
    isConfigured(p.id, savedSettings),
  ).length;

  function updateField(
    provider: OAuthProviderId,
    kind: "id" | "secret",
    value: string,
  ) {
    const key = OAUTH_FIELDS[provider][kind];
    setSettings((s) => ({ ...s, [key]: value }));
    setStatus((s) => ({ ...s, [provider]: IDLE }));
  }

  async function persist(
    provider: OAuthProviderId,
    next: ProjectOAuthSettings,
  ): Promise<boolean> {
    setStatus((s) => ({ ...s, [provider]: { state: "saving" } }));

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/orgs/${orgSlug}/projects/${projectSlug}/auth/settings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(next),
        },
      );

      if (!res.ok) throw new Error(await readError(res, "Save failed"));

      setSavedSettings(next);
      setStatus((s) => ({
        ...s,
        [provider]: { state: "saved", message: "Saved" },
      }));
      return true;
    } catch (err) {
      setStatus((s) => ({
        ...s,
        [provider]: {
          state: "error",
          message: err instanceof Error ? err.message : "Save failed",
        },
      }));
      return false;
    }
  }

  // Only this provider's fields are merged into what's already saved, so
  // unsaved edits in the other provider's form are not persisted by accident.
  function save(provider: OAuthProviderId) {
    const f = OAUTH_FIELDS[provider];
    void persist(provider, {
      ...savedSettings,
      [f.id]: settings[f.id] ?? "",
      [f.secret]: settings[f.secret] ?? "",
    });
  }

  async function removeCredentials(provider: OAuthProviderId) {
    const f = OAUTH_FIELDS[provider];
    const ok = await persist(provider, {
      ...savedSettings,
      [f.id]: "",
      [f.secret]: "",
    });
    if (ok) setSettings((s) => ({ ...s, [f.id]: "", [f.secret]: "" }));
    setProviderToRemove(null);
  }

  return (
    <div className="@container mx-auto w-full space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 @lg:flex-row @lg:items-start @lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Sign In / Providers
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure authentication providers for this project.
          </p>
        </div>

        <Badge
          variant="outline"
          className="self-start px-2.5 py-1 text-xs font-medium"
        >
          {enabledCount} of {PROVIDERS.length} enabled
        </Badge>
      </div>

      {/* Providers */}
      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const enabled = isConfigured(provider.id, savedSettings);
          const isOpen = selected === provider.id;
          const oauthId = provider.id === "email" ? null : provider.id;
          const dirty = oauthId ? isDirty(oauthId) : false;

          return (
            <Card
              key={provider.id}
              className="gap-0 overflow-hidden rounded-xl border border-border bg-card py-0"
            >
              <button
                type="button"
                onClick={() => setSelected(isOpen ? null : provider.id)}
                aria-expanded={isOpen}
                aria-controls={`provider-panel-${provider.id}`}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/30 @lg:gap-4"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                  {provider.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {provider.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {provider.description}
                  </p>
                </div>

                {dirty && (
                  <Badge
                    variant="outline"
                    className="hidden border-amber-500/30 bg-amber-500/10 text-[10px] font-normal text-amber-600 @lg:inline-flex dark:text-amber-400"
                  >
                    Unsaved changes
                  </Badge>
                )}

                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[10px] font-normal uppercase",
                    enabled
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground",
                  )}
                >
                  {provider.id === "email"
                    ? "Always on"
                    : enabled
                      ? "Enabled"
                      : "Disabled"}
                </Badge>

                <ChevronRight
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-90",
                  )}
                />
              </button>

              {isOpen && (
                <div
                  id={`provider-panel-${provider.id}`}
                  className="border-t border-border bg-muted/20 p-4"
                >
                  {provider.id === "email" ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 @lg:grid-cols-2">
                        {EMAIL_METHODS.map((method) => (
                          <div
                            key={method.title}
                            className="space-y-1 rounded-lg border border-border bg-card p-3"
                          >
                            <div className="flex items-center gap-1.5">
                              <Check className="size-3.5 text-emerald-500" />
                              <p className="text-sm font-medium text-foreground">
                                {method.title}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {method.description}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Both methods are always enabled for this project. No
                        extra configuration needed.
                      </p>
                    </div>
                  ) : (
                    oauthId && (
                      <OAuthForm
                        provider={oauthId}
                        clientId={settings[OAUTH_FIELDS[oauthId].id] ?? ""}
                        clientSecret={
                          settings[OAUTH_FIELDS[oauthId].secret] ?? ""
                        }
                        configured={enabled}
                        dirty={dirty}
                        status={status[oauthId]}
                        revealed={revealed[oauthId]}
                        onChange={(kind, value) =>
                          updateField(oauthId, kind, value)
                        }
                        onToggleReveal={() =>
                          setRevealed((r) => ({ ...r, [oauthId]: !r[oauthId] }))
                        }
                        onSave={() => save(oauthId)}
                        onRemove={() => setProviderToRemove(oauthId)}
                      />
                    )
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Remove credentials confirmation */}
      <Dialog
        open={!!providerToRemove}
        onOpenChange={(open) => {
          if (!open) setProviderToRemove(null);
        }}
      >
        <DialogContent className="sm:max-w-md border-border bg-card rounded-xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-lg font-semibold">
              Remove {providerToRemove ? OAUTH_META[providerToRemove].name : ""}{" "}
              credentials
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This clears the client ID and client secret and disables{" "}
              {providerToRemove ? OAUTH_META[providerToRemove].name : ""}{" "}
              sign-in for this project. You can add new credentials at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setProviderToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                !providerToRemove || status[providerToRemove].state === "saving"
              }
              onClick={() =>
                providerToRemove && void removeCredentials(providerToRemove)
              }
            >
              {providerToRemove && status[providerToRemove].state === "saving"
                ? "Removing..."
                : "Remove credentials"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OAuthForm({
  provider,
  clientId,
  clientSecret,
  configured,
  dirty,
  status,
  revealed,
  onChange,
  onToggleReveal,
  onSave,
  onRemove,
}: {
  provider: OAuthProviderId;
  clientId: string;
  clientSecret: string;
  configured: boolean;
  dirty: boolean;
  status: SaveStatus;
  revealed: boolean;
  onChange: (kind: "id" | "secret", value: string) => void;
  onToggleReveal: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const meta = OAUTH_META[provider];
  const saving = status.state === "saving";
  const partial = Boolean(clientId) !== Boolean(clientSecret);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty && !saving) onSave();
      }}
    >
      <p className="text-xs text-muted-foreground">
        Create an OAuth app in the{" "}
        <a
          href={meta.consoleUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
        >
          {meta.consoleLabel}
          <ExternalLink className="size-3" />
        </a>
        , then paste its credentials here.
      </p>

      <div className="grid gap-4 @2xl:grid-cols-2">
        <Field className="space-y-1.5">
          <FieldLabel
            htmlFor={`${provider}-client-id`}
            className="text-sm font-medium"
          >
            Client ID
          </FieldLabel>
          <Input
            id={`${provider}-client-id`}
            value={clientId}
            onChange={(e) => onChange("id", e.target.value)}
            placeholder={`${meta.name} OAuth client ID`}
            className="font-mono text-sm"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <Field className="space-y-1.5">
          <FieldLabel
            htmlFor={`${provider}-client-secret`}
            className="text-sm font-medium"
          >
            Client secret
          </FieldLabel>
          <div className="flex gap-2">
            <Input
              id={`${provider}-client-secret`}
              type={revealed ? "text" : "password"}
              value={clientSecret}
              onChange={(e) => onChange("secret", e.target.value)}
              placeholder={`${meta.name} OAuth client secret`}
              className="min-w-0 flex-1 font-mono text-sm"
              autoComplete="new-password"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={onToggleReveal}
              aria-label={
                revealed ? "Hide client secret" : "Show client secret"
              }
            >
              {revealed ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </Button>
          </div>
        </Field>
      </div>

      {partial && (
        <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {clientId
            ? "The client secret is empty. Sign-in with this provider won't work until it's set."
            : "The client ID is empty. Sign-in with this provider won't work until it's set."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? "Saving..." : `Save ${meta.name} settings`}
        </Button>

        {configured && (
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
            disabled={saving}
          >
            Remove credentials
          </Button>
        )}

        {status.state === "saved" && (
          <span
            className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
            role="status"
          >
            <Check className="size-3.5" />
            Saved
          </span>
        )}
        {status.state === "error" && (
          <span
            className="flex min-w-0 items-start gap-1 text-xs font-medium text-destructive"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span className="break-words">{status.message}</span>
          </span>
        )}
      </div>
    </form>
  );
}
