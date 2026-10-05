import {retrieveTokenFromCookie} from "@/server-utils/utils";
import apiClient from "@/lib/axios";
import {COOKIE_KEYS} from "@square-base-db/constants";
import {redirect} from "next/navigation";
import type {Project} from "@square-base-db/types";

// Function to retrieve the list of tables from the API for a given organization and project
// This function makes an authenticated GET request to the API endpoint that returns the list of tables.
// If the request is successful, it returns the list of table names; otherwise, it redirects to the projects page.
export async function retrieveTablesFromApi(
  orgSlug: string,
  projectSlug: string
): Promise<string[]> {
  // Retrieve the access token from cookies for authentication
  const token = await retrieveTokenFromCookie();

  try {
    // Make an authenticated GET request to the API endpoint to retrieve the list of tables
    const {data} = await apiClient.get<string[]>(
      `/orgs/${orgSlug}/projects/${projectSlug}/tables`,
      {headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}}
    );

    // Return the list of table names retrieved from the API
    return data;
  } catch {
    // If the request fails (e.g., due to authentication issues), redirect to the projects page
    redirect(`/organizations/${orgSlug}/projects`);
  }
}

export async function retrieveProjectDbSchema(
  orgSlug: string,
  projectSlug: string,
): Promise<string> {
  const token = await retrieveTokenFromCookie();

  try {
    const {data} = await apiClient.get<{ projects: Project }>(
      `/orgs/${orgSlug}/projects/${projectSlug}`,
      {headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}}
    );
    return data.projects.dbSchema;
  } catch {
    // If the request fails (e.g., due to authentication issues), redirect to the projects page
    redirect(`/organizations/${orgSlug}/projects`);
  }
}