import type {OrgMemberWithUser} from "@square-base-db/types";
import {retrieveTokenFromCookie} from "@/server-utils/utils";
import apiClient from "@/lib/axios";
import {COOKIE_KEYS} from "@square-base-db/constants";
import {redirect} from "next/navigation";

// Function to retrieve members of an organization from the API
// It takes the organization slug as a parameter and returns a promise
// that resolves to an array of OrgMemberWithUser objects
export async function retrieveMembersFromApi(
  slug: string
): Promise<OrgMemberWithUser[]> {
  // Retrieve the authentication token from cookies for API requests
  const token = await retrieveTokenFromCookie();

  // Make an API request to retrieve the members of the organization
  try {
    const {data} = await apiClient.get<OrgMemberWithUser[]>(
      `/orgs/${slug}/members`,
      {headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}}
    );
    return data;
  } catch {
    // If the API request fails, redirect the user to the organizations page
    redirect("/organizations");
  }
}