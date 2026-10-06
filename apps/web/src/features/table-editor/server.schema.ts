import {z} from "zod";
import {TABLE_EDITOR_INTENT} from "@square-base-db/constants";
import {
  addColumnSchema,
  createTableSchema,
  deleteTableSchema,
  fetchTableSchema
} from "@/features/table-editor/client.schema";

// Server schema for table editor actions
export const tableEditorServerSchema = z.discriminatedUnion("intent", [
  // Create table action
  // The columns field is expected to be a JSON string,
  // so we need to parse it and validate it against the createTableSchema
  // If the parsing or validation fails, we return a custom error message
  z.object({
    intent: z.literal(TABLE_EDITOR_INTENT.CREATE_TABLE),
    name: createTableSchema.shape.name,
    columns: z.string().transform((raw, ctx) => {
      try {
        const parsed: unknown = JSON.parse(raw);
        const result = createTableSchema.shape.columns.safeParse(parsed);

        if (!result.success) {
          ctx.addIssue({code: "custom", message: "Invalid columns format"});

          // Return z.NEVER to indicate that the validation failed
          return z.NEVER;
        }

        // Return the validated columns data
        return result.data;
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Invalid JSON format for columns"
        });

        // Return z.NEVER to indicate that the validation failed
        return z.NEVER;
      }
    })
  }),
  // Delete table action
  // The tableName field is expected to be a string,
  // so we can directly validate it against the deleteTableSchema
  z.object({
    intent: z.literal(TABLE_EDITOR_INTENT.DELETE_TABLE),
    ...deleteTableSchema.shape
  }),
  // Fetch table action
  // The tableName field is expected to be a string,
  // so we can directly validate it against the fetchTableSchema
  z.object({
    intent: z.literal(TABLE_EDITOR_INTENT.FETCH_TABLE),
    ...fetchTableSchema.shape
  }),
  // Add column action
  // The tableName, name, and type fields are expected to be strings,
  // so we can directly validate them against the addColumnSchema
  z.object({
    intent: z.literal(TABLE_EDITOR_INTENT.ADD_COLUMN),
    ...addColumnSchema.shape
  })
]);