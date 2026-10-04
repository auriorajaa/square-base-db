import type {
  ColumnType,
  CreateColumnInput,
  CreateTableInput,
} from "@square-base-db/types";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { COLUMN_TYPES } from "@square-base-db/constants";
import { Type } from "class-transformer";

export class CreateColumnDto implements CreateColumnInput {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(COLUMN_TYPES)
  type!: ColumnType;

  @IsBoolean()
  isNullable!: boolean;

  @IsBoolean()
  isPrimaryKey!: boolean;

  @IsString()
  @IsOptional()
  defaultValue?: string;

  @IsString()
  @IsOptional()
  foreignKeyTable?: string;

  @IsString()
  @IsOptional()
  foreignKeyColumn?: string;
}

export class CreateTableDto implements CreateTableInput {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateColumnDto)
  columns!: CreateColumnDto[];
}
