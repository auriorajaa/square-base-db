import {z} from "zod";
import {PROJECTS_INTENT} from "@/features/projects/constants";
import {createProjectSchema} from "@/features/projects/client.schema";

// Server schema for projects
// This schema is used to validate the request body for the projects API endpoint
export const projectsServerSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal(PROJECTS_INTENT.CREATE),
    ...createProjectSchema.shape
  })
]);