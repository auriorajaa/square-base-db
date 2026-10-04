"use client";

import {useActionState, useEffect, useState} from "react";
import {FolderPlus, Plus} from "lucide-react";
import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {Field, FieldError, FieldGroup, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import z from "zod";
import {createProjectSchema} from "./client.schema";
import {projectsAction} from "./action";
import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {PROJECTS_INTENT} from "./constants";

interface CreateProjectModalProps {
  slug: string;
}

type CreateProjectValues = z.infer<typeof createProjectSchema>;

export function CreateProjectModal({slug}: CreateProjectModalProps) {
  const [open, setOpen] = useState(false);
  const boundAction = projectsAction.bind(null, {slug});
  const [state, formAction, isPending] = useActionState(boundAction, {});

  const form = useForm<CreateProjectValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {name: ""},
  });

  // Safe side-effect to close modal and reset form on action success
  useEffect(() => {
    if (state.success && open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      form.reset();
    }
  }, [state.success, open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={true}
        render={
          <Button size="sm" className="font-medium">
            <Plus className="size-4 mr-1.5"/>
            New project
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md border-border bg-card rounded-xl">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <FolderPlus className="size-5 text-muted-foreground"/>
            Create a new project
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Each project gets its own isolated database schema, URL endpoint, and API keys.
          </DialogDescription>
        </DialogHeader>

        {state.error && (
          <div
            className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {state.error}
          </div>
        )}

        <form
          action={formAction}
          noValidate
          onSubmitCapture={async (e) => {
            const ok = await form.trigger(undefined, {shouldFocus: true});
            if (!ok) e.preventDefault();
          }}
          className="space-y-4 pt-2"
        >
          <FieldGroup className="space-y-2">
            <Controller
              name="name"
              control={form.control}
              render={({field, fieldState}) => (
                <Field data-invalid={fieldState.invalid} className="space-y-1.5">
                  <FieldLabel htmlFor="project-name" className="text-sm font-medium">
                    Project name
                  </FieldLabel>
                  <Input
                    {...field}
                    id="project-name"
                    placeholder="e.g. production-api"
                    aria-invalid={fieldState.invalid}
                    className="w-full"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]}/>
                  )}
                </Field>
              )}
            />
          </FieldGroup>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              name="intent"
              value={PROJECTS_INTENT.CREATE}
              disabled={isPending}
            >
              {isPending ? "Creating..." : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}