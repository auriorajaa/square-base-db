import {z} from "zod";
import {AUTH_INTENT} from "@/features/auth/constants";
import {loginSchema, registerSchema} from "@/features/auth/client.schema";

// Server schema for authentication requests
// This schema is used to validate the request body for authentication endpoints
export const authServerSchema = z.discriminatedUnion("intent", [
  z.object({intent: z.literal(AUTH_INTENT.LOGIN), ...loginSchema.shape}),
  z.object({intent: z.literal(AUTH_INTENT.REGISTER), ...registerSchema.shape})
]);