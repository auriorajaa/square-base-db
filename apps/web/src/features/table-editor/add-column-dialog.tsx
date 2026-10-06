"use client";

import {useState} from "react";
import {Plus} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Sheet, SheetContent, SheetDescription, SheetTitle,} from "@/components/ui/sheet";
import {Field, FieldGroup, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import {COLUMN_TYPES, TABLE_EDITOR_INTENT} from "@square-base-db/constants";
import type {ColumnType} from "@square-base-db/types";
import {tableEditorAction} from "@/features/table-editor/action";
import {cn} from "@/lib/utils";

interface AddColumnDialogProps {
  orgSlug: string;
  projectSlug: string;
  tableName: string;
  onAdded: () => void;
  className?: string;
}

const sheetClassName = cn(
  "flex h-full w-full max-w-full flex-col gap-0 border-l border-border p-0 shadow-none bg-card",
  "data-[side=right]:w-full data-[side=right]:max-w-full",
  "sm:data-[side=right]:w-[420px] sm:data-[side=right]:max-w-[420px]",
);

export function AddColumnDialog({
                                  orgSlug,
                                  projectSlug,
                                  tableName,
                                  onAdded,
                                  className,
                                }: AddColumnDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ColumnType>("text");
  const [defaultValue, setDefaultValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const reset = () => {
    setName("");
    setType("text");
    setDefaultValue("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData();
    formData.set("intent", TABLE_EDITOR_INTENT.ADD_COLUMN);
    formData.set("tableName", tableName);
    formData.set("name", name);
    formData.set("type", type);
    if (defaultValue.trim()) formData.set("defaultValue", defaultValue.trim());

    const result = await tableEditorAction(
      {orgSlug, projectSlug},
      {},
      formData,
    );

    setIsPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setOpen(false);
    reset();
    onAdded();
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground",
          className,
        )}
        onClick={() => setOpen(true)}
        aria-label="Add column"
      >
        <Plus className="size-3.5"/>
      </Button>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <SheetContent side="right" className={sheetClassName}>
          <div className="shrink-0 border-b border-border bg-muted/20 px-6 py-4 pr-12">
            <SheetTitle className="text-lg font-semibold">
              Add column to <span className="font-mono text-primary">{tableName}</span>
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs text-muted-foreground">
              Adds a new column via{" "}
              <span className="font-mono text-foreground">ALTER TABLE ... ADD COLUMN</span>.
            </SheetDescription>
          </div>

          {error && (
            <div
              className="shrink-0 mx-6 mt-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-4">
              <FieldGroup className="space-y-3">
                <Field className="space-y-1.5">
                  <FieldLabel htmlFor="column-name" className="text-sm font-medium">Name</FieldLabel>
                  <Input
                    id="column-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="column_name"
                    className="font-mono text-sm"
                    required
                  />
                </Field>

                <Field className="space-y-1.5">
                  <FieldLabel className="text-sm font-medium">Type</FieldLabel>
                  <Select
                    value={type}
                    onValueChange={(v) => v && setType(v as ColumnType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue/>
                    </SelectTrigger>
                    <SelectContent className="border-border">
                      {COLUMN_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="font-mono text-xs">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field className="space-y-1.5">
                  <FieldLabel htmlFor="column-default" className="text-sm font-medium">
                    Default (optional)
                  </FieldLabel>
                  <Input
                    id="column-default"
                    value={defaultValue}
                    onChange={(e) => setDefaultValue(e.target.value)}
                    placeholder="NULL"
                    className="font-mono text-sm"
                  />
                </Field>
              </FieldGroup>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-card px-6 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !name.trim()}>
                {isPending ? "Adding..." : "Add column"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}