import { OrgRole } from "@square-base-db/types";
import { SetMetadata } from "@nestjs/common";

export const ORG_ROLE_KEY = "orgRole";
export const RequireOrgRole = (role: OrgRole) =>
  SetMetadata(ORG_ROLE_KEY, role);
