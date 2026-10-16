import { retrieveOAuthFromApi } from "@/features/project-auth/project-auth-helpers.server";
import { ProjectAuthProviders } from "@/features/project-auth/project-auth-providers";

export default async function AuthProvidersPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = await params;
  const settings = await retrieveOAuthFromApi(slug, projectSlug);

  return (
    <ProjectAuthProviders
      orgSlug={slug}
      projectSlug={projectSlug}
      initialSettings={settings}
    />
  );
}
