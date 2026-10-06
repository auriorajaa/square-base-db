import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DrizzleService } from "../db/drizzle.service.js";
import type { ColumnType, TableColumn, TableInfo } from "@square-base-db/types";
import { organizations, projects } from "../db/schema/index.js";
import { and, eq, sql } from "drizzle-orm";
import { CreateTableDto } from "./dto/create-table.dto.js";
import { AddColumnDto } from "./dto/alter-table.dto.js";

@Injectable()
export class TableEditorService {
  constructor(private drizzle: DrizzleService) {}

  /**
   * Validates that a name is a safe SQL identifier.
   * Only allows: starts with letter/underscore, then letters, numbers, underscores.
   * This prevents SQL injection when the name is used in dynamic queries.
   */
  private assertSafeIdentifier(name: string, label: string): void {
    // Regex: must start with a-z, A-Z or _, then only a-z, A-Z, 0-9 or _
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new BadRequestException(
        `Invalid ${label}: ${name}. Must start with a letter or underscore and contain only letters, numbers, and underscores.`,
      );
    }
  }

  /**
   * Converts a PostgreSQL data type (from information_schema)
   * into our internal ColumnType used by the frontend/editor.
   */
  private mapPgTypeToColumnType(pgType: string): ColumnType {
    const map: Record<string, ColumnType> = {
      text: "text",
      "character varying": "text",
      integer: "integer",
      bigint: "bigint",
      boolean: "boolean",
      "timestamp with time zone": "timestamp",
      "timestamp without time zone": "timestamp",
      uuid: "uuid",
      jsonb: "jsonb",
      numeric: "numeric",
    };

    // Fallback to "text" if we don't recognize the type
    return map[pgType] ?? "text";
  }

  /**
   * Converts our internal ColumnType into the actual PostgreSQL type
   * that will be used in CREATE / ALTER TABLE statements.
   */
  private mapType(type: string): string {
    const map: Record<string, string> = {
      text: "TEXT",
      integer: "INTEGER",
      bigint: "BIGINT",
      boolean: "BOOLEAN",
      timestamp: "TIMESTAMPTZ",
      uuid: "UUID",
      jsonb: "JSONB",
      numeric: "NUMERIC",
    };

    return map[type] ?? "TEXT";
  }

  /**
   * Formats a default value so it can be safely used in SQL.
   * - Keeps special functions (now(), gen_random_uuid(), etc.) as-is
   * - Leaves numbers and booleans unquoted
   * - Quotes and escapes strings / jsonb values
   */
  private formatDefault(value: string, type: ColumnType): string {
    const trimmed = value.trim();
    if (!trimmed) return "";

    // Allow common PostgreSQL functions without quoting
    if (/^(now\(\)|gen_random_uuid\(\)|current_timestamp)$/i.test(trimmed)) {
      return trimmed;
    }

    // Booleans and numbers don't need quotes
    if (type === "boolean") return trimmed;
    if (type === "integer" || type === "bigint" || type === "numeric") {
      return trimmed;
    }

    // JSONB needs explicit cast
    if (type === "jsonb") {
      return `'${trimmed.replace(/'/g, "''")}'::jsonb`;
    }

    // Regular string → escape single quotes by doubling them
    return `'${trimmed.replace(/'/g, "''")}'`;
  }

  /**
   * Looks up the actual PostgreSQL schema name for a given org + project.
   * Throws NotFoundException if the project does not exist.
   */
  private async getProjectSchema(
    orgSlug: string,
    projectSlug: string,
  ): Promise<string> {
    const [row] = await this.drizzle.db
      .select({ dbSchema: projects.dbSchema })
      .from(projects)
      .innerJoin(organizations, eq(projects.orgId, organizations.id))
      .where(
        and(eq(organizations.slug, orgSlug), eq(projects.slug, projectSlug)),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(
        `Project not found for org: ${orgSlug}, project: ${projectSlug}`,
      );
    }

    return row.dbSchema;
  }

  /**
   * Returns a list of all base tables that exist in the project's schema.
   */
  async getTables(orgSlug: string, projectSlug: string): Promise<string[]> {
    const schema = await this.getProjectSchema(orgSlug, projectSlug);

    // Query information_schema to get all regular tables (not views)
    // in the given schema, sorted alphabetically.
    const result = await this.drizzle.db.execute<{ table_name: string }>(
      sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${schema}
          AND table_type = 'BASE TABLE'   -- only real tables, ignore views
        ORDER BY table_name ASC
      `,
    );

    return result.rows.map((r) => r.table_name);
  }

  /**
   * Returns detailed information about a single table:
   * - columns (name, type, nullable, default)
   * - which columns are part of the primary key
   * - foreign key relationships
   */
  async getTableInfo(
    orgSlug: string,
    projectSlug: string,
    tableName: string,
  ): Promise<TableInfo> {
    // Make sure the table name is a safe identifier before using it in SQL
    this.assertSafeIdentifier(tableName, "table name");

    const schema = await this.getProjectSchema(orgSlug, projectSlug);

    // 1. Get all columns of the table
    const columnsResult = await this.drizzle.db.execute<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      sql`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = ${schema}
          AND table_name = ${tableName}
        ORDER BY ordinal_position ASC   -- keep the original column order
      `,
    );

    // 2. Get primary key columns
    //    We join table_constraints → key_column_usage to find
    //    which columns belong to the PRIMARY KEY constraint.
    const pkResult = await this.drizzle.db.execute<{ column_name: string }>(
      sql`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = ${schema}
          AND tc.table_name = ${tableName}
      `,
    );

    // Create a Set of primary key column names for quick lookup
    // This allows us to easily check if a column is part of the primary key later.
    const pkColumns = new Set(pkResult.rows.map((r) => r.column_name));

    // 3. Get foreign key relationships
    //    - table_constraints     → finds FOREIGN KEY constraints
    //    - key_column_usage      → local column that has the FK
    //    - constraint_column_usage → the referenced (foreign) table + column
    const fkResult = await this.drizzle.db.execute<{
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }>(
      sql`
        SELECT
          kcu.column_name,
          ccu.table_name   AS foreign_table_name,
          ccu.column_name  AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = ${schema}
          AND tc.table_name = ${tableName}
      `,
    );

    // Build a quick lookup: local column → { foreign table, foreign column }
    const fkMap = new Map(
      fkResult.rows.map((r) => [
        r.column_name,
        { table: r.foreign_table_name, column: r.foreign_column_name },
      ]),
    );

    // 4. Combine everything into our TableColumn shape
    // We map each column from the database to our internal TableColumn type,
    // incorporating the primary key and foreign key information we gathered.
    // This gives us a complete view of the table's structure.
    const columns: TableColumn[] = columnsResult.rows.map((col) => ({
      name: col.column_name,
      type: this.mapPgTypeToColumnType(col.data_type),
      isNullable: col.is_nullable === "YES",
      isPrimaryKey: pkColumns.has(col.column_name),
      defaultValue: col.column_default,
      foreignKey: fkMap.get(col.column_name) ?? null,
    }));

    // If the table has no columns, it likely doesn't exist (or is a view), so throw an error.
    if (columns.length === 0) {
      throw new NotFoundException(
        `Table not found: ${tableName} in project: ${projectSlug}, org: ${orgSlug}`,
      );
    }

    // 5. Return the final TableInfo object
    return { name: tableName, columns };
  }

  /**
   * Checks if an error is due to a missing table.
   * This is useful for handling cases where a table is expected but doesn't exist.
   */
  private isMissingTableError(err: unknown): boolean {
    const code =
      err &&
      typeof err === "object" &&
      "cause" in err &&
      err.cause &&
      typeof err.cause === "object" &&
      "code" in err.cause
        ? String(err.cause.code)
        : null;

    return code === "42P01"; // PostgreSQL error code for "undefined table"
  }

  /**
   * Fetches rows from a table with pagination + total count.
   * Runs both queries in parallel for better performance.
   */
  async getTableRows(
    orgSlug: string,
    projectSlug: string,
    tableName: string,
    limit = 100,
    offset = 0,
  ): Promise<{ rows: Record<string, unknown>[]; count: number }> {
    // Prevent SQL injection via table name
    this.assertSafeIdentifier(tableName, "table name");

    // Get the actual schema name for the project
    // This ensures we query the correct schema in PostgreSQL.
    const schema = await this.getProjectSchema(orgSlug, projectSlug);

    try {
      // Run data query + count query at the same time
      const [rowsResult, countResult] = await Promise.all([
        // Get the actual rows
        this.drizzle.db.execute<Record<string, unknown>>(
          sql`
          SELECT *
          FROM ${sql.identifier(schema)}.${sql.identifier(tableName)}
                 LIMIT ${limit}
          OFFSET ${offset}
        `,
        ),

        // Get total number of rows (for pagination UI)
        this.drizzle.db.execute<{ count: string }>(
          sql`
          SELECT COUNT(*)::text AS count
          FROM ${sql.identifier(schema)}.${sql.identifier(tableName)}
        `,
        ),
      ]);

      // Return both the rows and the total count as a single object
      // Note: we parse the count from string to number for easier usage in the frontend.
      return {
        rows: rowsResult.rows,
        count: parseInt(countResult.rows[0]?.count ?? "0", 10),
      };
    } catch (err) {
      // If the error is due to a missing table, throw a NotFoundException with a clear message.
      if (this.isMissingTableError(err)) {
        throw new NotFoundException(
          `Table not found: ${tableName} in project: ${projectSlug}, org: ${orgSlug}`,
        );
      }
      throw err;
    }
  }

  /**
   * Creates a new table based on the provided DTO.
   * Supports:
   * - multiple column types
   * - single or composite primary keys
   * - foreign keys
   * - default values
   * - auto-increment (IDENTITY) for bigint primary keys
   */
  async createTable(
    orgSlug: string,
    projectSlug: string,
    dto: CreateTableDto,
  ): Promise<void> {
    // Validate the table name to prevent SQL injection
    // All identifiers (table name, column names, foreign key references) must be safe.
    this.assertSafeIdentifier(dto.name, "table name");

    // Get the actual schema name for the project
    const schema = await this.getProjectSchema(orgSlug, projectSlug);

    // Collect all columns that are marked as primary key
    const pkCols = dto.columns.filter((c) => c.isPrimaryKey);

    // Build the column definition strings
    const columnDefs = dto.columns.map((col) => {
      // Validate each column name to ensure it's a safe SQL identifier
      this.assertSafeIdentifier(col.name, "column name");

      // Validate foreign key references if provided
      // We check both the foreign key table and column names to ensure they are safe identifiers.
      if (col.foreignKeyTable) {
        this.assertSafeIdentifier(col.foreignKeyTable, "foreign key table");
      }
      // Validate foreign key column name if provided
      if (col.foreignKeyColumn) {
        this.assertSafeIdentifier(col.foreignKeyColumn, "foreign key column");
      }

      // Start building the column definition parts
      const parts: string[] = [];

      // Base: "column_name" TYPE
      let colDef = `"${col.name}" ${this.mapType(col.type)}`;

      // Auto-increment for single bigint primary key (PostgreSQL IDENTITY)
      if (col.isPrimaryKey && col.type === "bigint" && !col.defaultValue) {
        colDef += " GENERATED ALWAYS AS IDENTITY";
      }

      // Add the column definition to the parts array
      parts.push(colDef);

      // Inline PRIMARY KEY only when there is exactly one PK column
      if (col.isPrimaryKey && pkCols.length === 1) {
        parts.push("PRIMARY KEY");
      }

      // NOT NULL (skip for primary keys – they are already non-null)
      if (!col.isNullable && !col.isPrimaryKey) {
        parts.push("NOT NULL");
      }

      // Default value
      if (col.defaultValue) {
        parts.push(`DEFAULT ${this.formatDefault(col.defaultValue, col.type)}`);
      }

      return parts.join(" ");
    });

    // Composite primary key (when more than one column is marked as PK)
    const pkConstraint =
      pkCols.length > 1
        ? `PRIMARY KEY (${pkCols.map((c) => `"${c.name}"`).join(", ")})`
        : null;

    // Foreign key constraints
    const fkConstraints = dto.columns
      .filter((col) => col.foreignKeyTable && col.foreignKeyColumn)
      .map(
        (col) =>
          `FOREIGN KEY ("${col.name}") REFERENCES "${schema}"."${col.foreignKeyTable}" ("${col.foreignKeyColumn}")`,
      );

    // Combine everything: columns + optional PK constraint + FK constraints
    const allDefs = [
      ...columnDefs,
      ...(pkConstraint ? [pkConstraint] : []),
      ...fkConstraints,
    ].join(", ");

    // Execute the CREATE TABLE statement
    // Note: we still use a raw string here because the column definitions
    // are dynamically built. All identifiers have already been validated.
    await this.drizzle.db.execute(
      sql.raw(`CREATE TABLE "${schema}"."${dto.name}" (${allDefs})`),
    );
  }

  /**
   * Deletes a table from the project's schema.
   * Uses IF EXISTS so it doesn't throw if the table is already gone.
   */
  async deleteTable(
    orgSlug: string,
    projectSlug: string,
    tableName: string,
  ): Promise<void> {
    // Validate the table name to prevent SQL injection
    this.assertSafeIdentifier(tableName, "table name");

    // Get the actual schema name for the project
    const schema = await this.getProjectSchema(orgSlug, projectSlug);

    // Execute the DROP TABLE statement with IF EXISTS
    await this.drizzle.db.execute(
      sql`DROP TABLE IF EXISTS ${sql.identifier(schema)}.${sql.identifier(tableName)}`,
    );
  }

  /**
   * Adds a new column to an existing table.
   * Currently supports: name, type, and optional default value.
   */
  async addColumn(
    orgSlug: string,
    projectSlug: string,
    tableName: string,
    dto: AddColumnDto,
  ): Promise<void> {
    // Validate identifiers to prevent SQL injection
    this.assertSafeIdentifier(tableName, "table name");
    this.assertSafeIdentifier(dto.name, "column name");

    // Get the actual schema name for the project
    const schema = await this.getProjectSchema(orgSlug, projectSlug);

    // Build: "column_name" TYPE [DEFAULT ...]
    // Note: we don't handle NOT NULL or PRIMARY KEY here, as ALTER TABLE ADD COLUMN
    // doesn't allow adding a NOT NULL column without a default value.
    let colDef = `"${dto.name}" ${this.mapType(dto.type)}`;

    // Add default value if provided
    if (dto.defaultValue) {
      colDef += ` DEFAULT ${this.formatDefault(dto.defaultValue, dto.type)}`;
    }

    // We use sql.raw here because colDef is a dynamically built fragment
    // (all identifiers have already been validated).
    await this.drizzle.db.execute(
      sql.raw(`ALTER TABLE "${schema}"."${tableName}" ADD COLUMN ${colDef}`),
    );
  }

  /**
   * Removes a column from a table.
   */
  async dropColumn(
    orgSlug: string,
    projectSlug: string,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    // Validate identifiers to prevent SQL injection
    this.assertSafeIdentifier(tableName, "table name");
    this.assertSafeIdentifier(columnName, "column name");

    // Get the actual schema name for the project
    const schema = await this.getProjectSchema(orgSlug, projectSlug);

    // Execute the ALTER TABLE DROP COLUMN statement
    // Note: we use sql.identifier for the table and column names to ensure they are properly quoted.
    await this.drizzle.db.execute(
      sql`ALTER TABLE ${sql.identifier(schema)}.${sql.identifier(tableName)}
        DROP COLUMN ${sql.identifier(columnName)}`,
    );
  }

  /**
   * Updates a single row identified by its primary key.
   *
   * @param orgSlug       - Organization slug
   * @param projectSlug   - Project slug
   * @param tableName     - Name of the table
   * @param pkColumn      - Name of the primary key column
   * @param pkValue       - Value of the primary key
   * @param updates       - Object of column → new value pairs
   */
  async updateRow(
    orgSlug: string,
    projectSlug: string,
    tableName: string,
    pkColumn: string,
    pkValue: string,
    updates: Record<string, unknown>,
  ): Promise<void> {
    // Validate identifiers to prevent SQL injection
    this.assertSafeIdentifier(tableName, "table name");
    // Validate the primary key column name
    this.assertSafeIdentifier(pkColumn, "primary key column");

    // Validate every column name that will be updated
    Object.keys(updates).forEach((col) =>
      this.assertSafeIdentifier(col, "column name"),
    );

    // Get the actual schema name for the project
    const schema = await this.getProjectSchema(orgSlug, projectSlug);

    // Build: "col1" = $1, "col2" = $2, ...
    // We use sql.identifier for column names and parameterized values for safety.
    const setFragments = Object.entries(updates).map(
      ([col, val]) => sql`${sql.identifier(col)} = ${val}`,
    );

    // Execute the UPDATE statement
    // We use sql.join to combine the set fragments with commas.
    await this.drizzle.db.execute(
      sql`
        UPDATE ${sql.identifier(schema)}.${sql.identifier(tableName)}
        SET ${sql.join(setFragments, sql`, `)}
        WHERE ${sql.identifier(pkColumn)} = ${pkValue}
      `,
    );
  }
}
