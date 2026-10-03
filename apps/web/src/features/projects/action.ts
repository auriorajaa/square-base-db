"use server";

import {projectsServerSchema} from "@/features/projects/server.schema";
import {retrieveTokenFromCookie} from "@/server-utils/utils";
import {PROJECTS_INTENT} from "@/features/projects/constants";
import apiClient from "@/lib/axios";
import {COOKIE_KEYS} from "@square-base-db/constants";
import {revalidatePath} from "next/cache";

export type ProjectsActionState = {
  error?: string;
  success?: string;
}

// Main action function for handling project-related operations
export async function projectsAction(
  {slug}: { slug: string },
  _prev: ProjectsActionState,
  formData: FormData
): Promise<ProjectsActionState> {
  // Convert FormData to a plain object
  const raw = Object.fromEntries(formData);
  // Validate the raw data against the server schema
  const parsed = projectsServerSchema.safeParse(raw);

  // If validation fails, return the first error message
  if (!parsed.success) {
    return {error: parsed.error.flatten().formErrors[0] ?? "Invalid form data"};
  }

  const token = await retrieveTokenFromCookie();
  // Destructure the intent and the rest of the data from the parsed result
  const {intent, ...data} = parsed.data;

  // Handle different intents based on the action requested
  try {
    switch (intent) {
      // Handle the CREATE intent for creating a new project
      case PROJECTS_INTENT.CREATE: {
        await apiClient.post(
          `/orgs/${slug}/projects`,
          {name: (data as { name: string }).name},
          {headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}}
        );

        // Revalidate the path for the organization's projects to ensure the UI reflects the new project
        revalidatePath(`/organizations/${slug}/projects`);
        return {success: "Project created successfully"};
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return {error: err.response?.data?.message ?? "An error occurred while processing your request"};
  }
}