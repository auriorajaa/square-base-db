"use server";

import type {TableInfo} from "@square-base-db/types";
import {COOKIE_KEYS, TABLE_EDITOR_INTENT} from "@square-base-db/constants";
import {tableEditorServerSchema} from "@/features/table-editor/server.schema";
import {retrieveTokenFromCookie} from "@/server-utils/utils";
import apiClient from "@/lib/axios";

export type TableEditorActionState = {
  error?: string;
  success?: string;
  tableName?: string;
  tableData?: {
    info: TableInfo;
    rows: Record<string, unknown>[];
    count: number;
  }
}

type TableEditorContext = {
  orgSlug: string;
  projectSlug: string;
}

function authHeaders(token: string) {
  return {headers: {Cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${token}`}};
}

function basePath(orgSlug: string, projectSlug: string) {
  return `/orgs/${orgSlug}/projects/${projectSlug}/tables`;
}

// Server action for table editor
// This function handles the table editor actions (create, delete, fetch) based on the intent provided in the form data.
// It validates the form data against the server schema and performs the corresponding API request.
// If successful, it returns a success message or the fetched table data; otherwise, it returns an error message.
export async function tableEditorAction(
  {orgSlug, projectSlug}: TableEditorContext,
  _prev: TableEditorActionState,
  formData: FormData
): Promise<TableEditorActionState> {
  // Convert FormData to a plain object and validate it against the server schema
  const raw = Object.fromEntries(formData);
  // Validate the form data against the server schema
  const parsed = tableEditorServerSchema.safeParse(raw);

  // If validation fails, return the first error message
  if (!parsed.success) {
    return {error: parsed.error.flatten().formErrors[0] ?? "Invalid form data"};
  }

  // Retrieve the access token from cookies for authentication
  const token = await retrieveTokenFromCookie();
  const {intent} = parsed.data; // Extract the intent from the validated data
  // Construct the base API path for the table operations
  const base = basePath(orgSlug, projectSlug);
  // Prepare the authentication headers for the API requests
  const opts = authHeaders(token);

  try {
    switch (intent) {
      // Handle the create table action
      // Extract the table name and columns from the validated data
      // Send a POST request to create the table with the provided name and columns
      case TABLE_EDITOR_INTENT.CREATE_TABLE: {
        const {name, columns} = parsed.data;
        await apiClient.post(base, {name, columns}, opts);

        return {success: "Table created successfully", tableName: name};
      }

      // Handle the delete table action
      // Extract the table name from the validated data
      // Send a DELETE request to remove the specified table
      case TABLE_EDITOR_INTENT.DELETE_TABLE: {
        const {tableName} = parsed.data;
        await apiClient.delete(`${base}/${tableName}`, opts);

        return {success: "Table deleted successfully", tableName};
      }

      // Handle the fetch table action
      // Extract the table name from the validated data
      // Send GET requests to retrieve the table information and its rows
      // Return the fetched table data including info, rows, and count
      case TABLE_EDITOR_INTENT.FETCH_TABLE: {
        const {tableName} = parsed.data;
        const [infoRes, rowsRes] = await Promise.all([
          apiClient.get<TableInfo>(`${base}/${tableName}`, opts),
          apiClient.get<{ rows: Record<string, unknown>[]; count: number }>(
            `${base}/${tableName}/rows?limit=100`,
            opts
          )
        ]);

        // Return the fetched table data including info, rows, and count
        return {
          tableData: {
            info: infoRes.data,
            rows: rowsRes.data.rows,
            count: rowsRes.data.count
          }
        };
      }

      // Handle the add column action
      // Extract the table name, column name, type, and default value from the validated data
      // Send a PATCH request to add the new column to the specified table
      // Return a success message indicating that the column was added successfully
      case TABLE_EDITOR_INTENT.ADD_COLUMN: {
        const {tableName, name, type, defaultValue} = parsed.data;
        await apiClient.patch(
          `${base}/${tableName}/columns`,
          {name, type, defaultValue: defaultValue || undefined},
          opts
        );

        return {success: "Column added successfully", tableName};
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // If an error occurs during the API request, return the error message from the response
    // or a generic error message
    return {error: err.response?.data?.message ?? "An error occurred while processing the request"};
  }
}