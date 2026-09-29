import {OrganizationWithMeta} from "@square-base-db/types";
import {COOKIE_KEYS} from "@square-base-db/constants";
import {retrieveTokenFromCookie} from "@/server-utils/utils";
import apiClient from "@/lib/axios";
import {redirect} from "next/navigation";

// This function retrieves the organizations associated with the currently authenticated user from the API.
// It first retrieves the JWT token from the cookies,
// then makes a GET request to the "/orgs" endpoint of the API,
// passing the token in the request headers. If the request is successful,
// it returns the list of organizations. If there is an error (e.g., if the token is invalid or expired),
// it redirects the user to the login page.
export async function retrieveMyOrganizationsFromApi(): Promise<OrganizationWithMeta[]> {
  const token = await retrieveTokenFromCookie();

  // Make a GET request to the "/orgs" endpoint of the API with the JWT token in the headers
  try {
    const {data} = await apiClient.get<OrganizationWithMeta[]>("/orgs", {
      headers: {
        Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`
      }
    });

    // If the request is successful, return the list of organizations
    return data;
  } catch {
    // If there is an error (e.g., if the token is invalid or expired), redirect the user to the login page
    redirect("/login");
  }
}

// This function retrieves a specific organization by its slug from the API.
// It first retrieves the JWT token from the cookies,
// then makes a GET request to the "/orgs/{slug}" endpoint of the API,
// passing the token in the request headers. If the request is successful,
// it returns the organization data. If there is an error (e.g., if the token is invalid or expired),
// it redirects the user to the organizations page.
export async function retrieveOrganizationBySlugFromApi(slug: string) {
  const token = await retrieveTokenFromCookie();

  // Make a GET request to the "/orgs/{slug}" endpoint of the API with the JWT token in the headers
  try {
    const {data} = await apiClient.get(`/orgs/${slug}`, {
      headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}
    });

    // If the request is successful, return the organization data
    return data;
  } catch {
    // If there is an error (e.g., if the token is invalid or expired), redirect the user to the organizations page
    redirect("/organizations");
  }
}