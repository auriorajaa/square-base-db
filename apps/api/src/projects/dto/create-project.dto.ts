import type { CreateProjectInput } from "@square-base-db/types";
import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateProjectDto implements CreateProjectInput {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;
}
