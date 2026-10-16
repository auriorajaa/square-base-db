import { ProjectAuthShell } from "@/features/project-auth/project-auth-shell";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = await params;

  return (
    <div className="h-[calc(100dvh-(--spacing(14)))] flex flex-col -m-6 overflow-hidden">
      <ProjectAuthShell orgSlug={slug} projectSlug={projectSlug}>
        {children}
      </ProjectAuthShell>
    </div>
  );
}
