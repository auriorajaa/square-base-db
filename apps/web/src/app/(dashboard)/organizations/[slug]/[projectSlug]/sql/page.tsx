import {retrieveSqlHistoryFromApi} from "@/features/sql-editor/sql-editor-helpers.server";
import {SqlEditorClient} from "@/features/sql-editor/sql-editor-client";

export default async function SqlEditorPage({
                                              params,
                                            }: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const {slug, projectSlug} = await params;
  const history = await retrieveSqlHistoryFromApi(slug, projectSlug);

  return (
    <div
      className="-m-6 h-[calc(100%+3rem)] w-[calc(100%+3rem)] min-h-0 min-w-0 overflow-hidden bg-card">
      <SqlEditorClient
        orgSlug={slug}
        projectSlug={projectSlug}
        initialHistory={history}
      />
    </div>
  );
}