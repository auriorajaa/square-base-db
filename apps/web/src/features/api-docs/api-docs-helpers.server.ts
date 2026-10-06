import type {ProjectApiDocs, ProjectApiEndpoint, ProjectBySlugResponse} from "@square-base-db/types";
import {retrieveTokenFromCookie} from "@/server-utils/utils";
import {COOKIE_KEYS} from "@square-base-db/constants";
import apiClient from "@/lib/axios";
import {redirect} from "next/navigation";

// Build a list of API endpoints for a given table in the project
// Each endpoint includes the HTTP method, path, description, and example curl command
// The endpoints include GET, POST, PATCH, and DELETE methods for the table
// The GET endpoint supports query parameters for filtering, sorting, and pagination
// The POST, PATCH, and DELETE endpoints require a service role project key for write access
function buildEndpoints(
  projectUrl: string,
  tableName: string,
): ProjectApiEndpoint[] {
  const base = `${projectUrl}/rest/${tableName}`;

  return [
    {
      method: "GET",
      path: base,
      description: `Fetch rows from the ${tableName} table. Supports query parameters for filtering, sorting, and pagination. Anonymous access is allowed with an anon key.`,
      example: `curl "${base}?limit=10&order=created_at.desc" \\\n  -H "Authorization: Bearer <ANON_KEY>"`,
    },
    {
      method: "GET",
      path: `${base}?col=eq.value`,
      description: "Filter rows by column values. Supports operators like eq, neq, gt, lt, gte, lte, like, in. Example: ?status=eq.active",
      example: `curl "${base}?name=eq.Pants&price=gt.20" \\\n  -H "Authorization: Bearer <ANON_KEY>"`,
    },
    {
      method: "POST",
      path: base,
      description: "Insert a new row into the table. Requires a service role key for write access.",
      example: `curl -X POST "${base}" \\\n  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "New Item"}'`,
    },
    {
      method: "PATCH",
      path: `${base}/:id`,
      description: "Update an existing row by its primary key. Requires a service role key for write access.",
      example: `curl -X PATCH "${base}/123" \\\n  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "Updated Item"}'`,
    },
    {
      method: "DELETE",
      path: `${base}/:id`,
      description: "Delete an existing row by its primary key. Requires a service role key for write access.",
      example: `curl -X DELETE "${base}/123" \\\n  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"`,
    },
  ];
}

// Retrieve the project API documentation from the API server
// This function fetches the project details and the list of tables for the given organization and project slugs
// It then builds the API documentation including the project URL,
// anon key, service role key, and endpoints for each table
// If the API request fails, it redirects the user to the projects page for the organization
export async function retrieveApiDocsFromApi(
  orgSlug: string,
  projectSlug: string
): Promise<ProjectApiDocs> {
  const token = await retrieveTokenFromCookie();
  const headers = {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`};

  try {
    const [projectRes, tableRes] = await Promise.all([
      apiClient.get<ProjectBySlugResponse>(
        `/orgs/${orgSlug}/projects/${projectSlug}`,
        {headers}
      ),
      apiClient.get<string[]>(
        `/orgs/${orgSlug}/projects/${projectSlug}/tables`,
        {headers}
      )
    ]);

    const project = projectRes.data.projects;
    const tableNames = tableRes.data;

    return {
      projectUrl: project.projectUrl,
      anonKey: project.anonKey,
      serviceRoleKey: project.serviceRoleKey,
      tables: tableNames.map((name) => ({
        name,
        endpoints: buildEndpoints(project.projectUrl, name)
      }))
    };
  } catch {
    redirect(`/organizations/${orgSlug}/projects`);
  }
}