import { IsIn, IsOptional, IsString } from "class-validator";
import { COLUMN_TYPES } from "@square-base-db/constants";
import type { ColumnType } from "@square-base-db/types";

export class AddColumnDto {
  @IsString()
  name!: string;

  @IsIn(COLUMN_TYPES)
  type!: ColumnType;

  @IsOptional()
  @IsString()
  defaultValue?: string;
}
