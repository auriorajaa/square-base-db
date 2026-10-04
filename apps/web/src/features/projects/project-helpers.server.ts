import type {Project} from "@square-base-db/types";
import {retrieveTokenFromCookie} from "@/server-utils/utils";
import apiClient from "@/lib/axios";
import {COOKIE_KEYS} from "@square-base-db/constants";
import {redirect} from "next/navigation";

// Function to retrieve all projects for a given organization slug from the API
// It uses the access token from cookies for authentication
// If the request fails, it redirects the user to the organizations page
export async function retrieveProjectsFromApi(
  orgSlug: string
): Promise<Project[]> {
  const token = await retrieveTokenFromCookie();

  try {
    const {data} = await apiClient.get<Project[]>(
      `/orgs/${orgSlug}/projects`,
      {headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}}
    );

    return data;
  } catch {
    redirect("/organizations");
  }
}

// Function to retrieve a specific project by its slug for a given organization slug from the API
// It uses the access token from cookies for authentication
// If the request fails, it redirects the user to the organization's projects page
export async function retrieveProjectBySlugFromApi(
  orgSlug: string,
  projectSlug: string
): Promise<Project> {
  const token = await retrieveTokenFromCookie();

  try {
    const {data} = await apiClient.get<Project>(
      `/orgs/${orgSlug}/projects/${projectSlug}`,
      {headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}}
    );

    return data;
  } catch {
    redirect(`/organizations/${orgSlug}/projects`);
  }
}