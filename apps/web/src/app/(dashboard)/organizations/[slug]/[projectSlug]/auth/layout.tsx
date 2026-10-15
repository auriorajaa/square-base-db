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
    <div>
      <ProjectAuthShell orgSlug={slug} projectSlug={projectSlug}>
        {children}
      </ProjectAuthShell>
    </div>
  );
}
