import {z} from "zod";
import type {InviteMemberInput, UpdateRoleInput} from "@square-base-db/types";
import {ORG_ROLES} from "@square-base-db/constants";

export const inviteSchema = z.object({
  email: z.email("Invalid email address"),
}) satisfies z.ZodType<InviteMemberInput>;

export const updateRoleSchema = z.object({
  role: z.enum([ORG_ROLES.ADMIN, ORG_ROLES.DEVELOPER]),
}) satisfies z.ZodType<UpdateRoleInput>;