"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {UploadButton} from "@uploadthing/react";
import {ResizableHandle, ResizablePanel, ResizablePanelGroup,} from "@/components/ui/resizable";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,} from "@/components/ui/dialog";
import {Sheet, SheetContent, SheetDescription, SheetTitle,} from "@/components/ui/sheet";
import {Field, FieldGroup, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Copy,
  File as FileIcon,
  FolderOpen,
  Globe,
  LayoutGrid,
  List,
  Lock,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {cn} from "@/lib/utils";
import type {BucketAccess, StorageBucket, StorageObject,} from "@square-base-db/types";
import type {OurStorageRouter} from "../../../../api/src/storage/uploadthing";

interface StorageClientProps {
  orgSlug: string;
  projectSlug: string;
  initialBuckets: StorageBucket[];
  initialObjects?: StorageObject[];
}

type MobileView = "buckets" | "files";
type ViewMode = "grid" | "list";

const sheetClassName = cn(
  "flex h-full w-full max-w-full flex-col gap-0 border-l border-border p-0 shadow-none bg-card",
  "data-[side=right]:w-full data-[side=right]:max-w-full",
  "sm:data-[side=right]:w-[420px] sm:data-[side=right]:max-w-[420px]",
);

const ACCESS_OPTIONS: {
  value: BucketAccess;
  title: string;
  description: string;
}[] = [
  {
    value: "public",
    title: "Public",
    description: "Files are reachable via their URL without authentication.",
  },
  {
    value: "private",
    title: "Private",
    description: "Files need a signed URL, generated on demand, to be accessed.",
  },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join(", ");
    if (data.message) return data.message;
  } catch {
    // response body wasn't JSON, fall through to the generic message
  }
  return `${fallback} (HTTP ${res.status})`;
}

export function StorageClient({
                                orgSlug,
                                projectSlug,
                                initialBuckets,
                                initialObjects = [],
                              }: StorageClientProps) {
  const [buckets, setBuckets] = useState<StorageBucket[]>(initialBuckets);
  const [activeBucket, setActiveBucket] = useState<StorageBucket | null>(
    initialBuckets[0] ?? null,
  );
  const [objects, setObjects] = useState<StorageObject[]>(initialObjects);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("buckets");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketAccess, setNewBucketAccess] =
    useState<BucketAccess>("public");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [bucketToDelete, setBucketToDelete] = useState<StorageBucket | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [objectToDelete, setObjectToDelete] = useState<StorageObject | null>(
    null,
  );
  const [deletingObject, setDeletingObject] = useState(false);

  const loadGenRef = useRef(0);
  const activeBucketIdRef = useRef<string | null>(activeBucket?.id ?? null);

  useEffect(() => {
    activeBucketIdRef.current = activeBucket?.id ?? null;
  }, [activeBucket]);

  const apiBase = getApiBaseUrl();
  const storageBase = `${apiBase}/orgs/${orgSlug}/projects/${projectSlug}/storage`;
  const apiOrigin = useMemo(() => new URL(apiBase).origin, [apiBase]);

  const uploadFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const href =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const isOurApi = new URL(href).origin === apiOrigin;
      return fetch(input, {
        ...init,
        credentials: isOurApi ? "include" : init?.credentials,
      });
    },
    [apiOrigin],
  );

  const uploadUrl = useMemo(() => {
    if (!activeBucket) return "";
    return `${storageBase}/buckets/${activeBucket.id}/upload`;
  }, [storageBase, activeBucket]);

  const loadObjects = useCallback(
    async (bucket: StorageBucket) => {
      const gen = ++loadGenRef.current;

      setActiveBucket(bucket);
      setObjects([]);
      setSearch("");
      setLoadingObjects(true);

      try {
        const res = await fetch(`${storageBase}/buckets/${bucket.id}/objects`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(
            await readError(res, `Could not load files for "${bucket.name}"`),
          );
        }
        const data = (await res.json()) as StorageObject[];
        if (gen !== loadGenRef.current) return;
        setObjects(data);
      } catch (err) {
        if (gen !== loadGenRef.current) return;
        setError(err instanceof Error ? err.message : "Could not load files.");
      } finally {
        if (gen === loadGenRef.current) setLoadingObjects(false);
      }
    },
    [storageBase],
  );

  const selectBucket = useCallback(
    (bucket: StorageBucket) => {
      setMobileView("files");
      void loadObjects(bucket);
    },
    [loadObjects],
  );

  const openCreate = () => {
    setNewBucketName("");
    setNewBucketAccess("public");
    setCreateError(null);
    setCreateOpen(true);
  };

  const createBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newBucketName.trim();
    if (!name) return;

    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch(`${storageBase}/buckets`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify({name, access: newBucketAccess}),
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Could not create bucket"));
      }
      const bucket = (await res.json()) as StorageBucket;
      setBuckets((prev) => [...prev, bucket]);
      setCreateOpen(false);
      selectBucket(bucket);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not create bucket.",
      );
    } finally {
      setCreating(false);
    }
  };

  const confirmDeleteBucket = async () => {
    if (!bucketToDelete) return;
    const bucket = bucketToDelete;

    setDeleting(true);
    try {
      const res = await fetch(`${storageBase}/buckets/${bucket.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(
          await readError(res, `Could not delete bucket "${bucket.name}"`),
        );
      }

      setBuckets((prev) => prev.filter((b) => b.id !== bucket.id));
      if (activeBucket?.id === bucket.id) {
        loadGenRef.current++;
        setActiveBucket(null);
        setObjects([]);
        setLoadingObjects(false);
        setMobileView("buckets");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete bucket.",
      );
    } finally {
      setDeleting(false);
      setBucketToDelete(null);
    }
  };

  const requestDeleteBucket = (bucket: StorageBucket) => {
    setDeleteConfirmText("");
    setBucketToDelete(bucket);
  };

  const confirmDeleteObject = async () => {
    if (!objectToDelete) return;
    const object = objectToDelete;

    setDeletingObject(true);
    try {
      const res = await fetch(`${storageBase}/objects/${object.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(
          await readError(res, `Could not delete "${object.name}"`),
        );
      }
      setObjects((prev) => prev.filter((o) => o.id !== object.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete file.");
    } finally {
      setDeletingObject(false);
      setObjectToDelete(null);
    }
  };

  const copyUrl = async (object: StorageObject) => {
    try {
      let url = object.url;

      if (!url) {
        const res = await fetch(
          `${storageBase}/objects/${object.id}/signed-url`,
          {credentials: "include"},
        );
        if (!res.ok) {
          throw new Error(
            await readError(res, `Could not create a signed URL for "${object.name}"`),
          );
        }
        const data = (await res.json()) as { url: string };
        url = data.url;
      }

      await navigator.clipboard.writeText(url);
      setCopiedId(object.id);
      setTimeout(() => setCopiedId((c) => (c === object.id ? null : c)), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not copy URL.");
    }
  };

  const copyBucketId = async (bucket: StorageBucket) => {
    try {
      await navigator.clipboard.writeText(bucket.id);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const visibleObjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? objects.filter((o) => o.name.toLowerCase().includes(q))
      : objects;
  }, [objects, search]);

  const totalSize = useMemo(
    () => objects.reduce((sum, o) => sum + o.size, 0),
    [objects],
  );

  const activeBucketId = activeBucket?.id ?? null;

  const uploadButton =
    activeBucketId && uploadUrl ? (
      <UploadButton<OurStorageRouter, "bucketUploader">
        url={uploadUrl}
        endpoint="bucketUploader"
        fetch={uploadFetch}
        onUploadError={(err) => {
          setError(`Upload failed: ${err.message}`);
        }}
        onClientUploadComplete={async (files) => {
          for (const file of files) {
            try {
              const res = await fetch(
                `${storageBase}/buckets/${activeBucketId}/objects`,
                {
                  method: "POST",
                  headers: {"Content-Type": "application/json"},
                  credentials: "include",
                  body: JSON.stringify({
                    name: file.name,
                    size: file.size,
                    type: file.type ?? "application/octet-stream",
                    utKey: file.key,
                    url: file.ufsUrl,
                  }),
                },
              );
              if (!res.ok) {
                throw new Error(
                  await readError(res, `Could not save "${file.name}"`),
                );
              }
              const object = (await res.json()) as StorageObject;
              // ignore if the user switched buckets while uploading
              if (activeBucketIdRef.current === activeBucketId) {
                setObjects((prev) => [object, ...prev]);
              }
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Could not save file.",
              );
            }
          }
        }}
        appearance={{
          button:
            "ut-ready:bg-primary ut-ready:text-primary-foreground h-8 px-3 text-sm rounded-md",
          allowedContent: "hidden",
        }}
      />
    ) : null;

  const bucketPanel = (
    <BucketListPanel
      buckets={buckets}
      activeBucketId={activeBucketId}
      onSelect={selectBucket}
      onCreate={openCreate}
      onDelete={requestDeleteBucket}
      onCopyId={(bucket) => void copyBucketId(bucket)}
      className="lg:border-r lg:border-border"
    />
  );

  const filesPanelProps = {
    bucket: activeBucket,
    hasBuckets: buckets.length > 0,
    objects: visibleObjects,
    totalCount: objects.length,
    totalSize,
    loading: loadingObjects,
    viewMode,
    onViewModeChange: setViewMode,
    search,
    onSearchChange: setSearch,
    copiedId,
    onCopy: (object: StorageObject) => void copyUrl(object),
    onDelete: (object: StorageObject) => setObjectToDelete(object),
    onCreateBucket: openCreate,
    uploadButton,
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background">
      {error && (
        <div
          className="flex shrink-0 items-start gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0"/>
          <span className="min-w-0 flex-1 break-words">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="shrink-0 rounded p-0.5 hover:bg-destructive/10"
          >
            <X className="size-3.5"/>
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {/* Mobile + tablet: bucket list OR files view */}
        <div className="flex h-full min-h-0 w-full flex-col lg:hidden">
          {mobileView === "files" && activeBucket ? (
            <FilesPanel
              {...filesPanelProps}
              showBack
              onBack={() => setMobileView("buckets")}
            />
          ) : (
            bucketPanel
          )}
        </div>

        {/* Desktop only: resizable split pane */}
        <div className="hidden h-full min-h-0 w-full lg:flex">
          <ResizablePanelGroup
            orientation="horizontal"
            className="h-full w-full min-h-0"
          >
            <ResizablePanel
              id="storage-buckets"
              defaultSize="20%"
              minSize="15%"
              maxSize="30%"
            >
              {bucketPanel}
            </ResizablePanel>

            <ResizableHandle withHandle/>

            <ResizablePanel id="storage-files" defaultSize="80%" minSize="50%">
              <FilesPanel {...filesPanelProps} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      {/* Create bucket */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className={sheetClassName}>
          <div className="shrink-0 border-b border-border bg-muted/20 px-6 py-4 pr-12">
            <SheetTitle className="text-lg font-semibold">
              Create bucket
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs text-muted-foreground">
              Buckets group your files and control how they can be accessed.
            </SheetDescription>
          </div>

          {createError && (
            <div
              className="mx-6 mt-4 shrink-0 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {createError}
            </div>
          )}

          <form
            onSubmit={(e) => void createBucket(e)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-4">
              <FieldGroup className="space-y-4">
                <Field className="space-y-1.5">
                  <FieldLabel
                    htmlFor="bucket-name"
                    className="text-sm font-medium"
                  >
                    Name
                  </FieldLabel>
                  <Input
                    id="bucket-name"
                    value={newBucketName}
                    onChange={(e) => setNewBucketName(e.target.value)}
                    placeholder="my-bucket"
                    className="font-mono text-sm"
                    autoComplete="off"
                    required
                  />
                </Field>

                <Field className="space-y-1.5">
                  <FieldLabel className="text-sm font-medium">Access</FieldLabel>
                  <div className="grid grid-cols-1 gap-2">
                    {ACCESS_OPTIONS.map((option) => {
                      const selected = newBucketAccess === option.value;
                      const Icon = option.value === "private" ? Lock : Globe;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setNewBucketAccess(option.value)}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/30",
                          )}
                        >
                          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground"/>
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium text-foreground">
                              {option.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {option.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </FieldGroup>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-card px-6 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !newBucketName.trim()}>
                {creating ? "Creating..." : "Create bucket"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete bucket confirmation */}
      <Dialog
        open={!!bucketToDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setBucketToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md border-border bg-card rounded-xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-lg font-semibold">
              Delete bucket
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Delete{" "}
              <span className="font-mono text-foreground">
                {bucketToDelete?.name}
              </span>
              ? This permanently deletes the bucket and every file inside it.
              This action can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label
              htmlFor="confirm-bucket-name"
              className="text-xs text-muted-foreground"
            >
              Type{" "}
              <span className="font-mono text-foreground">
                {bucketToDelete?.name}
              </span>{" "}
              to confirm
            </label>
            <Input
              id="confirm-bucket-name"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="font-mono text-sm"
              autoComplete="off"
              disabled={deleting}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setBucketToDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDeleteBucket()}
              disabled={
                deleting || deleteConfirmText !== bucketToDelete?.name
              }
            >
              {deleting ? "Deleting..." : "Delete bucket"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete file confirmation */}
      <Dialog
        open={!!objectToDelete}
        onOpenChange={(open) => {
          if (!open && !deletingObject) setObjectToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md border-border bg-card rounded-xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-lg font-semibold">
              Delete file
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Delete{" "}
              <span className="break-all font-mono text-foreground">
                {objectToDelete?.name}
              </span>
              {objectToDelete ? ` (${formatBytes(objectToDelete.size)})` : ""}?
              It will be permanently removed from storage and its URL will stop
              working. This action can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setObjectToDelete(null)}
              disabled={deletingObject}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDeleteObject()}
              disabled={deletingObject}
            >
              {deletingObject ? "Deleting..." : "Delete file"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccessBadge({access}: { access: BucketAccess }) {
  const isPrivate = access === "private";

  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 gap-1 text-[10px] font-normal capitalize",
        isPrivate
          ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      )}
    >
      {isPrivate ? <Lock className="size-2.5"/> : <Globe className="size-2.5"/>}
      {access}
    </Badge>
  );
}

function BucketListPanel({
                           buckets,
                           activeBucketId,
                           onSelect,
                           onCreate,
                           onDelete,
                           onCopyId,
                           className,
                         }: {
  buckets: StorageBucket[];
  activeBucketId: string | null;
  onSelect: (bucket: StorageBucket) => void;
  onCreate: () => void;
  onDelete: (bucket: StorageBucket) => void;
  onCopyId: (bucket: StorageBucket) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-card", className)}>
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Buckets
          </span>
          <Badge variant="secondary" className="text-[10px] font-normal">
            {buckets.length}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs font-medium"
          onClick={onCreate}
        >
          <Plus className="size-3.5"/>
          New
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {buckets.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <FolderOpen className="mb-2 size-7 text-muted-foreground"/>
            <p className="text-sm font-medium text-foreground">No buckets yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a bucket to start uploading files.
            </p>
          </div>
        ) : (
          buckets.map((bucket) => {
            const active = activeBucketId === bucket.id;

            return (
              <div
                key={bucket.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(bucket)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(bucket);
                  }
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 px-3 py-3 text-sm transition-colors lg:py-2",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FolderOpen className="size-4 shrink-0 text-muted-foreground"/>
                  <span className="truncate">{bucket.name}</span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {bucket.access === "private" ? (
                    <Lock className="size-3 text-muted-foreground"/>
                  ) : (
                    <Globe className="size-3 text-muted-foreground"/>
                  )}

                  {/* Wrapper stops clicks (incl. portaled menu items) from selecting the row */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        nativeButton={true}
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            aria-label={`Options for ${bucket.name}`}
                          >
                            <MoreVertical className="size-3.5"/>
                          </Button>
                        }
                      />
                      <DropdownMenuContent
                        align="end"
                        className="w-48 border-border"
                      >
                        <DropdownMenuItem onClick={() => onCopyId(bucket)}>
                          Copy bucket ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDelete(bucket)}
                        >
                          Delete bucket
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div
        className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Globe className="size-3"/> Public: open URL
        </span>
        <span className="flex items-center gap-1">
          <Lock className="size-3"/> Private: signed URL
        </span>
      </div>
    </div>
  );
}

function ObjectActions({
                         object,
                         copied,
                         onCopy,
                         onDelete,
                         variant,
                       }: {
  object: StorageObject;
  copied: boolean;
  onCopy: (object: StorageObject) => void;
  onDelete: (object: StorageObject) => void;
  variant: "secondary" | "ghost";
}) {
  return (
    <>
      <Button
        variant={variant}
        size="icon"
        className="h-7 w-7"
        onClick={() => onCopy(object)}
        title={object.url ? "Copy URL" : "Copy signed URL"}
        aria-label={object.url ? "Copy URL" : "Copy signed URL"}
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-500"/>
        ) : (
          <Copy className="size-3.5"/>
        )}
      </Button>
      <Button
        variant={variant}
        size="icon"
        className="h-7 w-7 hover:text-destructive"
        onClick={() => onDelete(object)}
        title="Delete"
        aria-label={`Delete ${object.name}`}
      >
        <Trash2 className="size-3.5"/>
      </Button>
    </>
  );
}

function ObjectThumb({
                       object,
                       iconClassName,
                     }: {
  object: StorageObject;
  iconClassName: string;
}) {
  if (object.mimeType.startsWith("image/") && object.url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={object.url}
        alt={object.name}
        className="max-h-full max-w-full object-contain"
      />
    );
  }

  return <FileIcon className={cn("text-muted-foreground", iconClassName)}/>;
}

function FilesPanel({
                      bucket,
                      hasBuckets,
                      objects,
                      totalCount,
                      totalSize,
                      loading,
                      viewMode,
                      onViewModeChange,
                      search,
                      onSearchChange,
                      copiedId,
                      onCopy,
                      onDelete,
                      onCreateBucket,
                      uploadButton,
                      showBack,
                      onBack,
                    }: {
  bucket: StorageBucket | null;
  hasBuckets: boolean;
  objects: StorageObject[];
  totalCount: number;
  totalSize: number;
  loading: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  search: string;
  onSearchChange: (value: string) => void;
  copiedId: string | null;
  onCopy: (object: StorageObject) => void;
  onDelete: (object: StorageObject) => void;
  onCreateBucket: () => void;
  uploadButton: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}) {
  if (!bucket) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center bg-background px-4 text-center">
        <FolderOpen className="mb-3 size-8 text-muted-foreground"/>
        <p className="text-sm font-medium text-foreground">
          {hasBuckets ? "No bucket selected" : "No buckets yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasBuckets
            ? "Select a bucket from the sidebar to browse its files."
            : "Create your first bucket to start uploading files."}
        </p>
        {!hasBuckets && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5 font-medium"
            onClick={onCreateBucket}
          >
            <Plus className="size-4"/>
            Create bucket
          </Button>
        )}
      </div>
    );
  }

  const isSearching = search.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {showBack && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onBack}
                aria-label="Back to buckets"
              >
                <ChevronLeft className="size-4"/>
              </Button>
            )}
            <FolderOpen className="size-4 shrink-0 text-muted-foreground"/>
            <h2 className="truncate text-sm font-semibold text-foreground">
              {bucket.name}
            </h2>
            <AccessBadge access={bucket.access}/>
          </div>
          {uploadButton}
        </div>

        <p className="mt-1.5 text-xs text-muted-foreground">
          {loading
            ? "Loading files..."
            : `${totalCount} ${totalCount === 1 ? "file" : "files"} · ${formatBytes(totalSize)}`}
          {" · "}
          {bucket.access === "private"
            ? "Files need a signed URL (generated when you copy)."
            : "Files are reachable via their public URL."}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"/>
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="flex shrink-0 items-center rounded-md border border-border p-0.5">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => onViewModeChange("grid")}
            aria-label="Grid view"
            title="Grid view"
          >
            <LayoutGrid className="size-3.5"/>
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => onViewModeChange("list")}
            aria-label="List view"
            title="List view"
          >
            <List className="size-3.5"/>
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="animate-pulse text-xs font-medium text-muted-foreground">
            Loading files...
          </p>
        </div>
      ) : totalCount === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <FileIcon className="mb-3 size-8 text-muted-foreground"/>
          <p className="text-sm font-medium text-foreground">
            This bucket is empty
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload files using the button above.
          </p>
        </div>
      ) : objects.length === 0 && isSearching ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <Search className="mb-3 size-8 text-muted-foreground"/>
          <p className="text-sm font-medium text-foreground">No matching files</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nothing in this bucket matches &ldquo;{search.trim()}&rdquo;.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="min-h-0 w-full flex-1 overflow-y-auto">
          <div className="grid w-full grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:p-4 md:grid-cols-4 xl:grid-cols-5">
            {objects.map((object) => (
              <div
                key={object.id}
                className="group relative rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent/40"
              >
                <div className="mb-2 flex h-20 items-center justify-center overflow-hidden rounded-lg bg-muted/40">
                  <ObjectThumb object={object} iconClassName="size-8"/>
                </div>

                <p
                  className="truncate text-xs font-medium text-foreground"
                  title={object.name}
                >
                  {object.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {formatBytes(object.size)} · {object.mimeType}
                </p>

                <div
                  className="absolute right-2 top-2 flex gap-1 opacity-100 transition-opacity focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                  <ObjectActions
                    object={object}
                    copied={copiedId === object.id}
                    onCopy={onCopy}
                    onDelete={onDelete}
                    variant="secondary"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="min-h-0 w-full flex-1 divide-y divide-border overflow-y-auto">
          {objects.map((object) => (
            <div
              key={object.id}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30 sm:px-4"
            >
              <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/40">
                <ObjectThumb object={object} iconClassName="size-4"/>
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-medium text-foreground"
                  title={object.name}
                >
                  {object.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground md:hidden">
                  {object.mimeType}
                </p>
              </div>

              <span className="hidden w-44 shrink-0 truncate text-xs text-muted-foreground md:block">
                {object.mimeType}
              </span>
              <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                {formatBytes(object.size)}
              </span>

              <div className="flex shrink-0 gap-1">
                <ObjectActions
                  object={object}
                  copied={copiedId === object.id}
                  onCopy={onCopy}
                  onDelete={onDelete}
                  variant="ghost"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}