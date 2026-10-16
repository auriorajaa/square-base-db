import Link from "next/link";
import {ArrowRight, Building2, FolderKanban, Plus, Users} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {retrieveMyOrganizationsFromApi} from "@/features/organization/organization-helpers.server";

export default async function OrganizationsPage() {
  const orgs = await retrieveMyOrganizationsFromApi();

  return (
    <div className="mx-auto w-full space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Organizations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select an organization to manage projects, databases, and team
            members.
          </p>
        </div>

        <Button
          nativeButton={false}
          size="sm"
          className="h-9 gap-1.5 self-start text-xs font-medium sm:self-center"
          render={
            <Link href="/organizations/new">
              <Plus className="size-4"/>
              <span>New Organization</span>
            </Link>
          }
        />
      </div>

      {/* Empty state */}
      {orgs.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-4 py-20 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
            <Building2 className="size-6 text-muted-foreground"/>
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No organizations yet
          </h3>
          <p className="mt-1 mb-6 max-w-sm text-sm text-muted-foreground">
            You aren&apos;t a member of any organization. Create one to get
            started with projects and databases.
          </p>
          <Button
            nativeButton={false}
            size="sm"
            className="gap-1.5 text-xs font-medium"
            render={
              <Link href="/organizations/new">
                <Plus className="size-4"/>
                <span>Create Organization</span>
              </Link>
            }
          />
        </div>
      ) : (
        /* Organizations grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/organizations/${org.slug}/projects`}
              className="group flex flex-col justify-between space-y-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
            >
              {/* Top: icon + role */}
              <div className="flex items-start justify-between gap-3">
                <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                  {org.name}
                </p>
                {org.role && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium uppercase tracking-wide"
                  >
                    {org.role}
                  </Badge>
                )}
              </div>

              {/* Name + slug */}
              <div className="min-w-0 space-y-0.5">

                <p className="truncate font-mono text-xs text-muted-foreground">
                  {org.slug}
                </p>
              </div>

              {/* Footer stats */}
              <div
                className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <FolderKanban className="size-3.5"/>
                    {org.projectCount}{" "}
                    {org.projectCount === 1 ? "project" : "projects"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5"/>
                    {org.memberCount}{" "}
                    {org.memberCount === 1 ? "member" : "members"}
                  </span>
                </div>
                <ArrowRight
                  className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"/>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}