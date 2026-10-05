import {retrieveProjectDbSchema, retrieveTablesFromApi} from "@/features/table-editor/table-editor-helper.server";

export default async function DatabasePage({
                                             params,
                                           }: {
  params: Promise<{
    slug: string;
    projectSlug: string
  }>
}) {
  const {slug, projectSlug} = await params;

  const [tables, dbSchema] = await Promise.all([
    retrieveTablesFromApi(slug, projectSlug),
    retrieveProjectDbSchema(slug, projectSlug)
  ]);

  return (
    <div>
      <div></div>
    </div>
  );
}