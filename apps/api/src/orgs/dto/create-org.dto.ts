import { CreateOrgInput } from "@square-base-db/types";
import { IsString, MinLength } from "class-validator";

export class CreateOrgDto implements CreateOrgInput {
  @IsString()
  @MinLength(2)
  name!: string;
}
