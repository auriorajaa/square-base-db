import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DrizzleService } from "../db/drizzle.service.js";
import { projects } from "../db/schema/index.js";
import { eq, sql } from "drizzle-orm";
import { buildWhereClause, parseQueryParams } from "./query-parser.js";

@Injectable()
export class ProjectApiService {
  constructor(private drizzle: DrizzleService) {}

  /**
   * Checks if a name is safe to use as a SQL table/column name.
   *
   * Why we need this:
   * User can send anything in the URL or body.
   * If we put it directly into SQL, they could inject malicious code.
   * This regex only allows normal names like: users, created_at, user_id
   */
  private assertSafeIdentifier(name: string, label: string): void {
    // Must start with letter or underscore, then only letters/numbers/underscores
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new BadRequestException(`Invalid ${label}: ${name}`);
    }
  }

  /**
   * Turns a JavaScript value into something safe to put inside SQL.
   *
   * Examples:
   *   null      → NULL
   *   true      → TRUE
   *   42        → 42
   *   "O'Reilly" → 'O''Reilly'   (quote is escaped)
   */
  private formatLiteral(value: unknown): string {
    // Handle null and undefined
    if (value === null || value === undefined) return "NULL";

    // Handle boolean and number types
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";

    // Handle finite numbers
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);

    // For strings, escape single quotes by doubling them
    if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;

    // For objects (including arrays), convert to JSON and cast to jsonb
    if (typeof value === "object")
      return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;

    throw new BadRequestException(`Unsupported value type: ${typeof value}`);
  }

  /**
   * Finds the database schema for this project.
   * Also checks that the API key really belongs to the project in the URL.
   *
   * Flow:
   * 1. Look up project by ID (from API key)
   * 2. Make sure the slug matches the one in the URL
   * 3. Return the schema name (e.g. "project_abc123")
   */
  async resolveProjectSchema(
    projectId: string,
    projectSlug: string,
  ): Promise<string> {
    const [project] = await this.drizzle.db
      .select({
        dbSchema: projects.dbSchema,
        slug: projects.slug,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    // Project ID from API key doesn't exist
    if (!project) {
      throw new NotFoundException(`Project not found`);
    }

    // API key is valid, but user is trying to access a different project URL
    if (project.slug !== projectSlug) {
      throw new ForbiddenException(
        "API key does not match with current project url",
      );
    }

    return project.dbSchema;
  }

  /**
   * Finds which column is the primary key of a table.
   * We need this for UPDATE and DELETE (so we know what to put in the WHERE clause).
   *
   * Example result: "id" or "uuid" or "user_id"
   */
  private async getPrimaryKeyColumn(
    schema: string,
    tableName: string,
  ): Promise<string> {
    const result = await this.drizzle.db.execute<{ column_name: string }>(
      sql`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
               JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = ${schema}
          AND tc.table_name = ${tableName}
        ORDER BY kcu.ordinal_position ASC
          LIMIT 1
      `,
    );

    const pk = result.rows[0]?.column_name;

    // Table has no primary key → we can't safely update/delete by id
    if (!pk) {
      throw new BadRequestException(
        `Table ${tableName} does not have a primary key`,
      );
    }

    return pk;
  }

  /**
   * GET / rows from a table.
   * Supports: selecting specific columns, filtering, sorting, pagination.
   */
  async getRows(
    projectId: string,
    projectSlug: string,
    tableName: string,
    rawParams: Record<string, string>,
  ): Promise<Record<string, unknown>[]> {
    // 1. Make sure table name is safe
    this.assertSafeIdentifier(tableName, "table name");

    // 2. Get the schema + check API key ownership
    const schema = await this.resolveProjectSchema(projectId, projectSlug);

    // 3. Turn query string (?select=id,name&limit=10) into useful values
    const { select, filters, orderBy, limit, offset } =
      parseQueryParams(rawParams);

    // 4. Validate column names that came from the URL
    select.forEach((col) => this.assertSafeIdentifier(col, "select column"));
    if (orderBy) {
      this.assertSafeIdentifier(orderBy.column, "orderBy column");
    }

    // 5. Build the SELECT part
    //    select = ["id", "name"]  →  "id", "name"
    //    select = []              →  *
    const columns =
      select.length > 0 ? select.map((c) => `"${c}"`).join(", ") : "*";

    // 6. Build WHERE clause from filters (helper function)
    const where = buildWhereClause(filters);

    // 7. Build ORDER BY if user asked for sorting
    const order = orderBy
      ? `ORDER BY "${orderBy.column}" ${orderBy.direction}`
      : "";

    // 8. Put everything together into one SQL string
    //    (safe because we already validated all identifiers)
    const query = `
      SELECT ${columns}
      FROM "${schema}"."${tableName}"
      ${where}
      ${order}
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const result =
      await this.drizzle.db.execute<Record<string, unknown>>(query);

    return result.rows;
  }

  /**
   * INSERT one new row.
   * Body example: { "name": "John", "age": 25 }
   * Returns the inserted row (including auto-generated id, etc.).
   */
  async insertRow(
    projectId: string,
    projectSlug: string,
    tableName: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.assertSafeIdentifier(tableName, "table name");
    const schema = await this.resolveProjectSchema(projectId, projectSlug);

    // Turn { name: "John", age: 25 } into array of [key, value]
    const entries = Object.entries(body);

    if (entries.length === 0) {
      throw new BadRequestException("Request body cannot be empty");
    }

    // Make sure every column name in the body is safe
    entries.forEach(([col]) => this.assertSafeIdentifier(col, "column name"));

    // "name", "age"
    const columns = entries.map(([c]) => `"${c}"`).join(", ");

    // 'John', 25
    const values = entries.map(([, v]) => this.formatLiteral(v)).join(", ");

    const query = `
      INSERT INTO "${schema}"."${tableName}" (${columns})
      VALUES (${values})
        RETURNING *
    `;

    const result =
      await this.drizzle.db.execute<Record<string, unknown>>(query);

    // RETURNING * gives us the full row that was just inserted
    return result.rows[0];
  }

  /**
   * UPDATE one row by its primary key.
   * Example: update row where id = "abc-123"
   * Body contains only the fields you want to change.
   */
  async updateRow(
    projectId: string,
    projectSlug: string,
    tableName: string,
    rowId: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.assertSafeIdentifier(tableName, "table name");
    const schema = await this.resolveProjectSchema(projectId, projectSlug);

    // We don't hardcode "id" — different tables can have different PK names
    const pkColumn = await this.getPrimaryKeyColumn(schema, tableName);

    const entries = Object.entries(body);

    if (entries.length === 0) {
      throw new BadRequestException("Request body cannot be empty");
    }

    entries.forEach(([col]) => this.assertSafeIdentifier(col, "column name"));

    // Turns { name: "Jane", age: 30 } into:
    // "name" = 'Jane', "age" = 30
    const setClause = entries
      .map(([c, v]) => `"${c}" = ${this.formatLiteral(v)}`)
      .join(", ");

    const query = `
      UPDATE "${schema}"."${tableName}"
      SET ${setClause}
      WHERE "${pkColumn}" = ${this.formatLiteral(rowId)}
      RETURNING *
    `;

    const result =
      await this.drizzle.db.execute<Record<string, unknown>>(query);

    // If no row was updated, the ID doesn't exist
    if (!result.rows[0]) {
      throw new NotFoundException(`Row with ID ${rowId} not found`);
    }

    return result.rows[0];
  }

  /**
   * DELETE one row by its primary key.
   * Returns the deleted row so the frontend can show what was removed.
   */
  async deleteRow(
    projectId: string,
    projectSlug: string,
    tableName: string,
    rowId: string,
  ): Promise<Record<string, unknown>> {
    this.assertSafeIdentifier(tableName, "table name");
    const schema = await this.resolveProjectSchema(projectId, projectSlug);
    const pkColumn = await this.getPrimaryKeyColumn(schema, tableName);

    const query = `
      DELETE FROM "${schema}"."${tableName}"
      WHERE "${pkColumn}" = ${this.formatLiteral(rowId)}
        RETURNING *
    `;

    const result =
      await this.drizzle.db.execute<Record<string, unknown>>(query);

    // If no row was deleted, the ID doesn't exist
    if (!result.rows[0]) {
      throw new NotFoundException(`Row with ID ${rowId} not found`);
    }

    return result.rows[0];
  }
}
