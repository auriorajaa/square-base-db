import type { OrgRole } from "@square-base-db/types";
import { IsEnum } from "class-validator";
import { ORG_ROLES } from "@square-base-db/constants";

export class UpdateRoleDto {
  @IsEnum(ORG_ROLES)
  role!: OrgRole;
}
