import { BadRequestException } from "@nestjs/common";
import {
  FILTER_OPERATORS,
  FilterOperator,
  RESERVED_QUERY_PARAMS,
} from "@square-base-db/constants";

export interface ParsedQuery {
  select: string[];
  filters: FilterClause[];
  orderBy: OrderClause | null;
  limit: number;
  offset: number;
}

interface FilterClause {
  column: string;
  operator: string;
  value: string;
}

interface OrderClause {
  column: string;
  direction: "ASC" | "DESC";
}

function assertSafeIdentifier(name: string, label: string): void {
  // Ensure the identifier is a valid SQL identifier
  // (alphanumeric and underscores, not starting with a digit)
  // This is a basic check and may need to be adjusted
  // based on the database's rules for identifiers.
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new BadRequestException(`Invalid ${label}: ${name}`);
  }
}

function formatSqlValue(operator: string, rawValue: string): string {
  // Remove semicolons from the value to prevent SQL injection
  // This is a basic sanitization step; further validation may be needed based on the context.
  const value = rawValue.replace(/;/g, "");

  // Handle special cases for SQL operators
  // For example, the "IS" operator is used for NULL checks,
  // and "LIKE"/"ILIKE" are used for pattern matching.
  if (operator === "IS") {
    return value.toUpperCase() === "NULL" ? "NULL" : "NOT NULL";
  }

  // For LIKE and ILIKE operators, escape single quotes in the value
  // This is important to prevent SQL injection and ensure the query behaves as expected.
  if (operator === "LIKE" || operator === "ILIKE") {
    return `'${value.replace(/'/g, "''")}'`;
  }

  // For boolean values, return them as lowercase strings
  // This is important because SQL typically expects boolean literals to be in lowercase.
  if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
    return value.toLowerCase();
  }

  // For numeric values, return them as-is
  // This is important because SQL expects numeric literals to be unquoted.
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return value; // Return numeric values as-is
  }

  // For all other cases, treat the value as a string and escape single quotes
  return `'${value.replace(/'/g, "''")}'`; // Escape single quotes for string values
}

export function parseQueryParams(params: Record<string, string>): ParsedQuery {
  // Initialize the parsed query components
  const filters: FilterClause[] = [];
  // Initialize the select array to hold the columns to be selected
  let select: string[] = [];
  // Initialize the orderBy clause to null, indicating no ordering by default
  let orderBy: OrderClause | null = null;
  // Set default limit and offset values for pagination
  let limit = 100;
  let offset = 0;

  // Iterate over each key-value pair in the query parameters
  for (const [key, value] of Object.entries(params)) {
    // Check if the key is a reserved query parameter (select, order, limit, offset)
    if (RESERVED_QUERY_PARAMS.has(key)) {
      switch (key) {
        // Handle the "select" parameter, which specifies the columns to be selected
        // Split the value by commas, trim whitespace, and filter out empty strings
        case "select":
          select = value
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
          select.forEach((col) => assertSafeIdentifier(col, "select column"));
          break;

        // Handle the "order" parameter, which specifies the column and direction for ordering
        // The value is expected to be in the format "column.direction" (e.g., "name.asc" or "age.desc")
        // Split the value by the dot, validate the column name, and set the orderBy clause
        case "order": {
          const [col, dir] = value.split(".");
          assertSafeIdentifier(col, "order column");
          orderBy = {
            column: col,
            direction: dir?.toUpperCase() === "DESC" ? "DESC" : "ASC",
          };
          break;
        }

        // Handle the "limit" parameter, which specifies the maximum number of records to return
        // Parse the value as an integer, default to 100 if parsing fails, and cap it at 1000
        case "limit": {
          limit = Math.min(parseInt(value, 10) || 100, 1000);
          break;
        }

        // Handle the "offset" parameter, which specifies the number of records to skip
        // Parse the value as an integer, default to 0 if parsing fails, and ensure it's non-negative
        case "offset": {
          offset = Math.min(parseInt(value, 10) || 0, 0);
          break;
        }
      }
      // Skip to the next iteration of the loop since reserved parameters have been handled
      continue;
    }

    // For non-reserved parameters, treat them as filter clauses
    assertSafeIdentifier(key, "filter column");

    // Find the index of the dot in the value, which separates the operator from the filter value
    const dotIndex = value.indexOf(".");
    // If there's no dot, skip this parameter since it's not a valid filter
    if (dotIndex === -1) continue;

    // Extract the operator and filter value from the parameter value
    const operator = value.slice(0, dotIndex) as FilterOperator;
    const filterValue = value.slice(dotIndex + 1); // The part after the dot is the actual value to filter by

    // Check if the operator is valid by looking it up in the FILTER_OPERATORS mapping
    // If the operator is not valid, skip this parameter
    if (!(operator in FILTER_OPERATORS)) continue;

    // Add the filter clause to the filters array with the column name, operator, and formatted value
    filters.push({
      // Use the key as the column name, the mapped operator, and the formatted filter value
      column: key,
      // Map the operator to its corresponding SQL representation using the FILTER_OPERATORS mapping
      operator: FILTER_OPERATORS[operator],
      // Format the filter value based on the operator and sanitize it to prevent SQL injection
      value: filterValue,
    });
  }

  // Return the parsed query components as an object
  // This includes the selected columns, filter clauses, order by clause, limit, and offset for pagination.
  return { select, filters, orderBy, limit, offset };
}

// Build the WHERE clause from the filter clauses
export function buildWhereClause(filters: FilterClause[]): string {
  // If there are no filters, return an empty string since there's no WHERE clause to build
  if (filters.length === 0) return "";

  // Map each filter clause to its corresponding SQL representation
  // This involves formatting the value based on the operator and constructing the SQL condition for each filter.
  // For example, a filter clause with column "age", operator ">", and value "30" would be converted to `"age" > 30`.
  const clauses = filters.map(({ column, operator, value }) => {
    // Format the value based on the operator and sanitize it to prevent SQL injection
    const sqlValue = formatSqlValue(operator, value);

    // Construct the SQL condition based on the operator
    // For example, if the operator is "IS", the condition would be `"column" IS value`.
    if (operator === "IS") {
      return `"${column}" IS ${sqlValue}`;
    }

    // For LIKE and ILIKE operators, construct the condition with the appropriate operator
    // This is important for pattern matching in SQL queries.
    if (operator === "LIKE" || operator === "ILIKE") {
      return `"${column}" ${operator} ${sqlValue}`;
    }

    // For all other operators, construct the condition with the operator and formatted value
    return `"${column}" ${operator} ${sqlValue}`;
  });

  // Join all the individual clauses with " AND " to form the complete WHERE clause
  // This ensures that all filter conditions must be satisfied for a record to be included in the results.
  // Finally, return the complete WHERE clause as a string, prefixed with "WHERE ".
  return `WHERE ${clauses.join(" AND ")}`;
}
