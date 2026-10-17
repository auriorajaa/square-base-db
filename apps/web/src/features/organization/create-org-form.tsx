"use client";

import z from "zod";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createOrgSchema } from "./client.schema";
import { useActionState } from "react";
import { organizationAction } from "./action";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ORGANIZATION_INTENT } from "./constants";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type CreateOrgValues = z.infer<typeof createOrgSchema>;

export function CreateOrgForm() {
  const [state, formAction, isPending] = useActionState(organizationAction, {});
  const form = useForm<CreateOrgValues>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: { name: "" },
  });

  return (
    <form
      action={formAction}
      noValidate
      onSubmitCapture={async (e) => {
        const ok = await form.trigger(undefined, { shouldFocus: true });

        if (!ok) e.preventDefault();
      }}
      className="@container"
    >
      <input type="hidden" name="intent" value={ORGANIZATION_INTENT.CREATE} />

      <div className="space-y-4 p-4">
        {state.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 break-words">{state.error}</span>
          </div>
        )}

        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="space-y-1.5">
                <FieldLabel htmlFor="name" className="text-sm font-medium">
                  Organization name
                </FieldLabel>
                <Input
                  id="name"
                  placeholder="My Company"
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                  {...field}
                  name="name"
                />

                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Use your company, team, or group name. A URL slug is
                    generated from it automatically.
                  </p>
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-4 py-3 @sm:flex-row @sm:justify-end @sm:px-6">
        <Button
          nativeButton={false}
          variant="outline"
          className="w-full @sm:w-auto"
          render={<Link href="/organizations">Cancel</Link>}
        />
        <Button
          type="submit"
          className="w-full @sm:w-auto"
          disabled={isPending}
        >
          {isPending ? "Creating..." : "Create Organization"}
        </Button>
      </div>
    </form>
  );
}
