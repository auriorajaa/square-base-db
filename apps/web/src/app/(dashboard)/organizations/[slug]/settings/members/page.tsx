import {MembersClient} from "@/features/members/members-client";
import {retrieveOrganizationBySlugFromApi} from "@/features/organization/organization-helpers.server";
import {retrieveMembersFromApi} from "@/features/members/members-helpers.server";

export default async function MembersSettingsPage({
                                                    params,
                                                  }: {
  params: Promise<{ slug: string }>;
}) {
  const {slug} = await params;

  const [org, members] = await Promise.all([
    retrieveOrganizationBySlugFromApi(slug),
    retrieveMembersFromApi(slug),
  ]);

  return (
    <div className="mx-auto space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Team Members
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage who has access to <span className="font-medium text-foreground">{org.name}</span> and assign
          permissions.
        </p>
      </div>

      <MembersClient slug={slug} members={members} currentUserRole={org.role}/>
    </div>
  );
}