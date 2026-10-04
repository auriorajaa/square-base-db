import Link from "next/link";
import {Database, FolderKanban} from "lucide-react";
import {retrieveOrganizationBySlugFromApi} from "@/features/organization/organization-helpers.server";
import {retrieveProjectsFromApi} from "@/features/projects/project-helpers.server";
import {ORG_ROLES} from "@square-base-db/constants";
import {CreateProjectModal} from "@/features/projects/create-project-modal";

export default async function ProjectsPage({
                                             params,
                                           }: {
  params: Promise<{ slug: string }>;
}) {
  const {slug} = await params;

  const [org, projects] = await Promise.all([
    retrieveOrganizationBySlugFromApi(slug),
    retrieveProjectsFromApi(slug),
  ]);

  const isAdmin = org.role === ORG_ROLES.ADMIN;

  return (
    <div className="mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage infrastructure, databases, and APIs for <span
            className="font-medium text-foreground">{org.name}</span>.
          </p>
        </div>
        {isAdmin && <CreateProjectModal slug={slug}/>}
      </div>

      {/* Empty State */}
      {projects.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-border rounded-xl bg-card">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted mb-4">
            <FolderKanban className="size-6 text-muted-foreground"/>
          </div>
          <h3 className="text-base font-semibold text-foreground">No projects yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mt-1 mb-6">
            There are no projects set up in {org.name}. Create your first project to start provisioning resources.
          </p>
          {isAdmin && <CreateProjectModal slug={slug}/>}
        </div>
      ) : (
        /* Projects Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/organizations/${slug}/${project.slug}/database`}
              className="group flex flex-col justify-between p-5 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors space-y-4"
            >
              <div className="flex items-start gap-3.5">
                <div
                  className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border">
                  <Database className="size-5 text-muted-foreground group-hover:text-primary transition-colors"/>
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                    {project.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
                    {project.projectUrl || `${project.slug}.squarebase.app`}
                  </p>
                </div>
              </div>

              {/*<div*/}
              {/*  className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-3">*/}
              {/*  <span>Active</span>*/}
              {/*  /!*<span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">*!/*/}
              {/*  /!*  PostgreSQL*!/*/}
              {/*  /!*</span>*!/*/}
              {/*</div>*/}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}