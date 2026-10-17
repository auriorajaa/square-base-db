"use client";

import { useActionState, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Link2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { projectAuthAction } from "./project-auth-action";
import { siteUrlSchema } from "./project-auth-client.schema";
import { PROJECT_AUTH_INTENT } from "./project-auth-constants";

type SiteUrlValues = z.infer<typeof siteUrlSchema>;

function CopyRow({
  label,
  description,
  value,
}: {
  label: string;
  description: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable (e.g. insecure context)
    }
  }

  return (
    <li className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs font-medium"
          onClick={() => void copy()}
          aria-label={`Copy ${label} URL`}
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-500" />
              <span className="hidden @lg:inline">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              <span className="hidden @lg:inline">Copy</span>
            </>
          )}
        </Button>
      </div>

      <code className="block break-all rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
        {value}
      </code>
    </li>
  );
}

export function ProjectAuthUrlConfig({
  orgSlug,
  projectSlug,
  initialSiteUrl,
  apiBaseUrl,
}: {
  orgSlug: string;
  projectSlug: string;
  initialSiteUrl: string;
  apiBaseUrl: string;
}) {
  const boundAction = projectAuthAction.bind(null, { orgSlug, projectSlug });
  const [state, formAction, isPending] = useActionState(boundAction, {});

  const form = useForm<SiteUrlValues>({
    resolver: zodResolver(siteUrlSchema),
    defaultValues: { siteUrl: initialSiteUrl },
  });

  const isDirty = form.formState.isDirty;

  // After a successful save, treat the saved value as the new baseline so the
  // form is "clean" again (and Save is disabled until the next edit).
  useEffect(() => {
    if (state.success) form.reset(form.getValues());
  }, [state, form]);

  const redirectUrls = [
    {
      label: "Google callback",
      description: "Authorized redirect URI for your Google OAuth client.",
      value: `${apiBaseUrl}/projects/${projectSlug}/auth/google/callback`,
    },
    {
      label: "GitHub callback",
      description: "Authorization callback URL for your GitHub OAuth app.",
      value: `${apiBaseUrl}/projects/${projectSlug}/auth/github/callback`,
    },
    {
      label: "Magic link verify",
      description:
        "Opened from the sign-in email. It isn't registered with Google or GitHub.",
      value: `${apiBaseUrl}/projects/${projectSlug}/auth/magic-link/verify`,
    },
  ];

  return (
    <div className="@container mx-auto w-full space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          URL Configuration
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure the site URL and redirect URLs used by auth providers.
        </p>
      </div>

      {/* Site URL */}
      <Card className="gap-0 rounded-xl border border-border bg-card py-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Site URL
            </h2>
          </div>
          {isDirty && (
            <Badge
              variant="outline"
              className="border-amber-500/30 bg-amber-500/10 text-[10px] font-normal text-amber-600 dark:text-amber-400"
            >
              Unsaved changes
            </Badge>
          )}
        </div>

        <CardContent className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            Where users land after OAuth sign-in. This is your app&apos;s URL.
          </p>

          {state.error && (
            <div
              className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 break-words">{state.error}</span>
            </div>
          )}
          {state.success && !isDirty && (
            <div
              className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400"
              role="status"
            >
              <Check className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 break-words">{state.success}</span>
            </div>
          )}

          <form
            action={formAction}
            noValidate
            onSubmitCapture={async (e) => {
              const ok = await form.trigger(undefined, { shouldFocus: true });
              if (!ok) e.preventDefault();
            }}
            className="max-w-xl space-y-4"
          >
            <FieldGroup>
              <Controller
                name="siteUrl"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="space-y-1.5"
                  >
                    <FieldLabel
                      htmlFor="siteUrl"
                      className="text-sm font-medium"
                    >
                      Site URL
                    </FieldLabel>
                    <Input
                      {...field}
                      id="siteUrl"
                      inputMode="url"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="http://localhost:3001"
                      aria-invalid={fieldState.invalid}
                      className="font-mono text-sm"
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Include the protocol, for example https://myapp.com.
                      </p>
                    )}
                  </Field>
                )}
              />
            </FieldGroup>

            <Button
              type="submit"
              name="intent"
              value={PROJECT_AUTH_INTENT.SAVE_SITE_URL}
              disabled={isPending || !isDirty}
            >
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Redirect URLs */}
      <Card className="gap-0 overflow-hidden rounded-xl border border-border bg-card py-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Redirect URLs
            </h2>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {redirectUrls.length}
            </Badge>
          </div>
        </div>

        <div className="space-y-1 border-b border-border bg-muted/20 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Add the callback URLs in your OAuth app settings:{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
            >
              Google Cloud Console
              <ExternalLink className="size-3" />
            </a>{" "}
            and{" "}
            <a
              href="https://github.com/settings/developers"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
            >
              GitHub Developer Settings
              <ExternalLink className="size-3" />
            </a>
            .
          </p>
        </div>

        <ul className="divide-y divide-border">
          {redirectUrls.map((item) => (
            <CopyRow
              key={item.value}
              label={item.label}
              description={item.description}
              value={item.value}
            />
          ))}
        </ul>
      </Card>
    </div>
  );
}
