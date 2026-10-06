import {retrieveProjectDbSchema, retrieveTablesFromApi} from "@/features/table-editor/table-editor-helper.server";
import {TableEditorClient} from "@/features/table-editor/table-editor-client";

export default async function DatabasePage({
                                             params,
                                           }: {
  params: Promise<{
    slug: string;
    projectSlug: string;
  }>;
}) {
  const {slug, projectSlug} = await params;

  const [tables, dbSchema] = await Promise.all([
    retrieveTablesFromApi(slug, projectSlug),
    retrieveProjectDbSchema(slug, projectSlug),
  ]);

  return (
    <div className="h-[calc(100vh-(--spacing(14)))] flex flex-col -m-6 overflow-hidden">
      <TableEditorClient
        orgSlug={slug}
        projectSlug={projectSlug}
        dbSchema={dbSchema}
        initialTables={tables}
      />
    </div>
  );
}