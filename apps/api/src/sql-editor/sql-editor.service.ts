import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  FullQueryResults,
  NeonQueryFunction,
} from "@neondatabase/serverless";
import { and, desc, eq, sql } from "drizzle-orm";
import { parse } from "pgsql-ast-parser";
import type { QueryResult } from "@square-base-db/types";
import { DrizzleService } from "../db/drizzle.service.js";
import { organizations, projects, queryHistory } from "../db/schema/index.js";

@Injectable()
export class SqlEditorService {
  constructor(private drizzle: DrizzleService) {}

  /**
   * Ensures a name is safe to use as a SQL identifier (schema, role, etc.).
   * Only allows: starts with a letter/underscore, then letters, numbers, underscores.
   * Prevents SQL injection when the name is placed into dynamic SQL.
   */
  private assertSafeIdentifier(name: string, label: string): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new BadRequestException(`Invalid ${label}: ${name}`);
    }
  }

  /**
   * Builds the Postgres role name for a project, derived from its schema name.
   * Example: schema "proj_abc123" -> role "proj_abc123_role"
   */
  private roleName(dbSchema: string): string {
    return `${dbSchema}_role`;
  }

  /**
   * Validates that the input contains exactly one SQL statement and returns it.
   *
   * Uses a real SQL parser instead of split(';'), so semicolons inside string
   * literals, comments or dollar-quoted bodies are handled correctly.
   * Blocks tricks like: RESET ROLE; SELECT * FROM public.users
   */
  private parseSingleStatement(querySql: string): string {
    // Remove trailing semicolons/whitespace so "SELECT 1;" counts as one statement
    const trimmed = querySql
      .trim()
      .replace(/;+\s*$/, "")
      .trim();

    if (trimmed.length === 0) {
      throw new BadRequestException("SQL query cannot be empty");
    }

    let statementCount: number;
    try {
      statementCount = parse(trimmed).length;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Syntax error";
      throw new BadRequestException(`Invalid SQL: ${message}`);
    }

    if (statementCount !== 1) {
      throw new BadRequestException(
        "Only one SQL statement per run. Remove extra statements after a semicolon.",
      );
    }

    return trimmed;
  }

  private getNeonClient(): NeonQueryFunction<false, true> {
    const client = (
      this.drizzle.db as unknown as {
        $client: NeonQueryFunction<false, true>;
      }
    ).$client;

    if (!client?.transaction) {
      throw new Error("Neon HTTP client is not available");
    }

    return client;
  }

  private normalizePgResult(result: FullQueryResults<false>): {
    rows: Record<string, unknown>[];
    rowCount: number;
    command: string;
  } {
    const rows = (result.rows ?? []) as Record<string, unknown>[];

    return {
      rows,
      rowCount: result.rowCount ?? rows.length,
      command: result.command ?? "SELECT",
    };
  }

  /**
   * Looks up a project by organization slug + project slug.
   * Returns only the fields we need (id + dbSchema).
   */
  private async getProject(orgSlug: string, projectSlug: string) {
    const [row] = await this.drizzle.db
      .select({
        id: projects.id,
        dbSchema: projects.dbSchema,
      })
      .from(projects)
      .innerJoin(organizations, eq(projects.orgId, organizations.id))
      .where(
        and(eq(organizations.slug, orgSlug), eq(projects.slug, projectSlug)),
      )
      .limit(1);

    if (!row) throw new NotFoundException("Project not found");
    return row;
  }

  /**
   * Creates a dedicated schema + NOLOGIN role for a project and sets permissions.
   * Idempotent: safe to call multiple times.
   *
   * Call this:
   * - When a new project is created (from your projects service)
   * - Once for every project that existed before this logic was added
   */
  async provisionProjectSchema(dbSchema: string): Promise<void> {
    this.assertSafeIdentifier(dbSchema, "project schema");
    const role = this.roleName(dbSchema);

    const statements = [
      // 1. Schema for this project only
      `CREATE SCHEMA IF NOT EXISTS "${dbSchema}"`,

      // 2. CREATE ROLE has no IF NOT EXISTS, so wrap it in a DO block
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
           CREATE ROLE "${role}" NOLOGIN;
         END IF;
       END $$`,

      // 3. Allow the app connection to SET ROLE into the project role
      `GRANT "${role}" TO CURRENT_USER`,

      // 4. Full access only inside the project's own schema
      `GRANT USAGE, CREATE ON SCHEMA "${dbSchema}" TO "${role}"`,
      `GRANT ALL ON ALL TABLES IN SCHEMA "${dbSchema}" TO "${role}"`,
      `GRANT ALL ON ALL SEQUENCES IN SCHEMA "${dbSchema}" TO "${role}"`,
      `GRANT ALL ON ALL FUNCTIONS IN SCHEMA "${dbSchema}" TO "${role}"`,
      // Default privileges apply to objects created later as well
      `ALTER DEFAULT PRIVILEGES IN SCHEMA "${dbSchema}" GRANT ALL ON TABLES TO "${role}"`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA "${dbSchema}" GRANT ALL ON SEQUENCES TO "${role}"`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA "${dbSchema}" GRANT ALL ON FUNCTIONS TO "${role}"`,

      // 5. Make sure the role cannot touch the public schema (users, etc.)
      `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${role}"`,
      `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM "${role}"`,
    ];

    for (const stmt of statements) {
      // Identifiers were validated above, so raw SQL is safe here
      await this.drizzle.db.execute(sql.raw(stmt));
    }
  }

  /**
   * Runs a single SQL statement for a project.
   *
   * Security steps (all inside one Neon transaction):
   * 1. Exactly one statement is allowed
   * 2. SET LOCAL ROLE: drop from the app/admin role to the project role
   * 3. SET LOCAL search_path: only the project schema, no public
   * 4. SET LOCAL settings disappear automatically when the transaction ends
   *
   * Access control is enforced by Postgres permissions on the project role,
   * so the old startsWith() blocklist is no longer needed.
   */
  async executeQuery(
    orgSlug: string,
    projectSlug: string,
    querySql: string,
  ): Promise<QueryResult> {
    const project = await this.getProject(orgSlug, projectSlug);
    const statement = this.parseSingleStatement(querySql);

    this.assertSafeIdentifier(project.dbSchema, "project schema");
    const role = this.roleName(project.dbSchema);

    const start = Date.now();

    try {
      const neonSql = this.getNeonClient();

      const results = await neonSql.transaction(
        (txn) => [
          // 1) Switch to the limited project role
          txn`${txn.unsafe(`SET LOCAL ROLE "${role}"`)}`,
          // 2) Only the project schema is visible
          txn`SET LOCAL search_path TO ${txn.unsafe(`"${project.dbSchema}"`)}`,
          // 3) The user's statement
          txn`${txn.unsafe(statement)}`,
        ],
        { fullResults: true, readOnly: false },
      );

      const executionTimeMs = Date.now() - start;
      const { rows, rowCount, command } = this.normalizePgResult(
        results[results.length - 1],
      );
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      // The transaction is finished, so this insert runs as the normal app role
      await this.drizzle.db.insert(queryHistory).values({
        projectId: project.id,
        sql: querySql,
        executionTimeMs,
        rowCount,
      });

      return {
        rows,
        columns,
        rowCount,
        executionTimeMs,
        command,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Query failed";
      throw new BadRequestException(message);
    }
  }

  /**
   * Returns the last 50 queries run for this project (newest first).
   */
  async getHistory(orgSlug: string, projectSlug: string) {
    const project = await this.getProject(orgSlug, projectSlug);

    return this.drizzle.db
      .select()
      .from(queryHistory)
      .where(eq(queryHistory.projectId, project.id))
      .orderBy(desc(queryHistory.createdAt))
      .limit(50);
  }
}
