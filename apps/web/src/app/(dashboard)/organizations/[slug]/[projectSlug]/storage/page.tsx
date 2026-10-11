import {retrieveBucketsFromApi, retrieveObjectsFromApi} from "@/features/storage/storage-helpers.server";
import {StorageClient} from "@/features/storage/storage-client";

export default async function StoragePage({
                                            params
                                          }: {
  params: Promise<{ slug: string; projectSlug: string }>
}) {
  const {slug, projectSlug} = await params;
  const buckets = await retrieveBucketsFromApi(slug, projectSlug);
  const initialObjects = buckets[0]
    ? await retrieveObjectsFromApi(slug, projectSlug, buckets[0].id)
    : [];

  return (
    <div className="h-[calc(100dvh-(--spacing(14)))] flex flex-col -m-6 overflow-hidden">
      <StorageClient
        orgSlug={slug}
        projectSlug={projectSlug}
        initialBuckets={buckets}
        initialObjects={initialObjects}
      />
    </div>
  );
}