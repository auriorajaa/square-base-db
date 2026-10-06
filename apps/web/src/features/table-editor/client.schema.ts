import {z} from "zod";
import {COLUMN_TYPES} from "@square-base-db/constants";
import type {CreateTableInput} from "@square-base-db/types";

export const createColumnSchema = z.object({
  name: z.string().min(1, "Column name is required"),
  type: z.enum(COLUMN_TYPES),
  isNullable: z.boolean(),
  isPrimaryKey: z.boolean(),
  defaultValue: z.string().optional(),
  foreignKeyTable: z.string().optional(),
  foreignKeyColumn: z.string().optional(),
});

export const createTableSchema = z.object({
  name: z.string().min(1, "Table name is required"),
  columns: z.array(createColumnSchema).min(1, "At least one column is required"),
}) satisfies z.ZodType<CreateTableInput>;

export const fetchTableSchema = z.object({
  tableName: z.string().min(1, "Table name is required"),
});

export const deleteTableSchema = z.object({
  tableName: z.string().min(1, "Table name is required"),
});

export const addColumnSchema = z.object({
  tableName: z.string().min(1, "Table name is required"),
  name: z
    .string()
    .min(1, "Column name is required")
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Column name must start with a letter or underscore and can only contain letters, numbers, and underscores"),
  type: z.enum(COLUMN_TYPES),
  defaultValue: z.string().optional(),
});