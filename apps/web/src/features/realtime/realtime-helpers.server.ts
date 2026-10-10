import {retrieveTokenFromCookie} from "@/server-utils/utils";
import apiClient from "@/lib/axios";
import {COOKIE_KEYS} from "@square-base-db/constants";
import {Project, ProjectBySlugResponse} from "@square-base-db/types";
import {redirect} from "next/navigation";

// This function retrieves the project information for real-time operations
// based on the organization slug and project slug.
export async function retrieveProjectForRealtime(
  orgSlug: string,
  projectSlug: string
): Promise<Pick<Project, "id" | "anonKey">> {
  // Retrieve the access token from cookies to authenticate the API request.
  const token = await retrieveTokenFromCookie();

  // Make an API request to get the project details using the organization slug and project slug.
  try {
    // The API request is made to the endpoint `/orgs/${orgSlug}/projects/${projectSlug}`.
    // The access token is included in the request headers for authentication.
    const {data} = await apiClient.get<ProjectBySlugResponse>(
      `/orgs/${orgSlug}/projects/${projectSlug}`,
      {headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}}
    );

    // If the request is successful, return an object containing the project ID and anonymous key.
    return {id: data.projects.id, anonKey: data.projects.anonKey};
  } catch {
    // If the request fails (e.g., project not found or unauthorized),
    // redirect the user to the projects page of the organization.
    redirect(`/organizations/${orgSlug}/projects`);
  }
}

// This function retrieves the list of tables for real-time operations
// based on the organization slug and project slug.
export async function retrieveTablesForRealtime(
  orgSlug: string,
  projectSlug: string
): Promise<string[]> {
  // Retrieve the access token from cookies to authenticate the API request.
  const token = await retrieveTokenFromCookie();

  // Make an API request to get the list of tables for the specified project.
  try {
    // The API request is made to the endpoint `/orgs/${orgSlug}/projects/${projectSlug}/tables`.
    // The access token is included in the request headers for authentication.
    const {data} = await apiClient.get<string[]>(
      `/orgs/${orgSlug}/projects/${projectSlug}/tables`,
      {headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}}
    );

    // If the request is successful, return the list of table names.
    return data;
  } catch {
    // If the request fails (e.g., project not found or unauthorized),
    // return an empty array to indicate that no tables could be retrieved.
    return [];
  }
}