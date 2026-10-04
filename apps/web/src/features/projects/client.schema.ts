import {z} from "zod";
import type {CreateProjectInput} from "@square-base-db/types";

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters long")
    .max(50, "Name must be at most 50 characters long"),
}) satisfies z.ZodType<CreateProjectInput>;