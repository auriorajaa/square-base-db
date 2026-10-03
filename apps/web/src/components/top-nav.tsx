"use client";

import {useParams} from "next/navigation";
import {SidebarTrigger} from "@/components/ui/sidebar";
import {Separator} from "@/components/ui/separator";
import {Button} from "@/components/ui/button";
import {Check, ChevronsUpDown, Folder} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {Project} from "@square-base-db/types";
import Link from "next/link";

interface TopNavProps {
  projects: Project[];
}

export function TopNav({projects}: TopNavProps) {
  const params = useParams<{ slug: string; projectSlug: string }>();
  const currentProject = projects.find((p) => p.slug === params?.projectSlug);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1"/>
        <Separator orientation="vertical" className="mr-2 h-4"/>

        {params?.slug && (
          <DropdownMenu>
            <DropdownMenuTrigger
              nativeButton={true}
              render={
                <Button variant="ghost" size="sm" className="gap-2 font-medium text-sm">
                  <Folder className="size-4 text-muted-foreground"/>
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    {currentProject?.name ?? "Select project"}
                  </span>
                  <ChevronsUpDown className="size-3.5 text-muted-foreground"/>
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-56 border-border rounded-lg">
              {projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  nativeButton={false}
                  render={
                    <Link
                      href={`/organizations/${params.slug}/${project.slug}/database`}
                      className="flex items-center justify-between w-full cursor-pointer"
                    >
                      <span className="truncate">{project.name}</span>
                      {project.slug === params?.projectSlug && (
                        <Check className="size-4 text-primary ml-auto"/>
                      )}
                    </Link>
                  }
                />
              ))}

              {projects.length > 0 && <DropdownMenuSeparator/>}

              <DropdownMenuItem
                nativeButton={false}
                render={
                  <Link
                    href={`/organizations/${params.slug}/projects`}
                    className="w-full cursor-pointer font-medium text-xs text-muted-foreground"
                  >
                    All projects
                  </Link>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}