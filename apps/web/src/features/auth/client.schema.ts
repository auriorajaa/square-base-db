import {z} from "zod";
import {LoginInput, RegisterInput} from "@square-base-db/types";

export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
}) satisfies z.ZodType<LoginInput>;

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
}) satisfies z.ZodType<RegisterInput>;