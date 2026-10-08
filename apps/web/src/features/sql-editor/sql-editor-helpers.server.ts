import type {QueryHistoryItem} from "@square-base-db/types";
import {retrieveTokenFromCookie} from "@/server-utils/utils";
import apiClient from "@/lib/axios";
import {COOKIE_KEYS} from "@square-base-db/constants";
import {redirect} from "next/navigation";

export async function retrieveSqlHistoryFromApi(
  orgSlug: string,
  projectSlug: string
): Promise<QueryHistoryItem[]> {
  const token = await retrieveTokenFromCookie();

  try {
    const {data} = await apiClient.get<QueryHistoryItem[]>(
      `/orgs/${orgSlug}/projects/${projectSlug}/sql/history`,
      {headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}}
    );

    return data;
  } catch {
    redirect(`organizations/${orgSlug}/projects`);
  }
}