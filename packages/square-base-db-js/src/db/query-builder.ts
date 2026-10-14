/**
 * HTTP methods this query builder can send.
 * GET    = read rows
 * POST   = insert a row
 * PATCH  = update a row (needs eq("id", ...))
 * DELETE = delete a row (needs eq("id", ...))
 */
export type Httpmethod = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * One filter condition, e.g. { column: "status", operator: "eq", value: "active" }
 * Becomes query param: status=eq.active
 */
interface FilterClause {
  column: string;
  operator: string;
  value: string;
}

/**
 * Standard result shape for every request.
 * - data  → the row(s) if success, otherwise null
 * - error → error message if failed, otherwise null
 */
export interface QueryResult<T> {
  data: T | null;
  error: string | null;
}

/**
 * Fluent query builder (chain methods, then await).
 *
 * Example:
 *   const { data, error } = await client
 *     .from("users")
 *     .select("id, name")
 *     .eq("status", "active")
 *     .order("created_at", "desc")
 *     .limit(10);
 *
 * Why `then()` exists:
 *   So you can `await` the builder directly without calling `.execute()`.
 *   JS/TS treats any object with a `.then()` method as a Promise-like (thenable).
 */
export class QueryBuilder<T = Record<string, unknown>> {
  // Default = read operation
  private _method: Httpmethod = "GET";

  // Body for POST (insert) / PATCH (update). Null for GET/DELETE.
  private _body: Record<string, unknown> | null = null;

  // Collected WHERE-style filters (eq, gt, like, ...)
  private _filters: FilterClause[] = [];

  // Columns for SELECT. Empty array means "*" (all columns).
  private _selectColumns: string[] = [];

  // ORDER BY column + direction
  private _orderCol: string | null = null;
  private _orderDir: "asc" | "desc" = "asc";

  // Pagination
  private _limitVal: number | null = null;
  private _offsetVal: number | null = null;

  /**
   * @param projectUrl - Base API URL, e.g. "https://api.example.com/v1/proj_xxx"
   * @param table      - Table name, e.g. "users"
   * @param apiKey     - Bearer token sent on every request
   */
  constructor(
    private projectUrl: string,
    private table: string,
    private apiKey: string,
  ) {
  }

  // ── Read helpers ──────────────────────────────────────────────────────────

  /**
   * Choose columns to return.
   *   .select("*")           → all columns (default)
   *   .select("id, name")    → only id and name
   */
  select(columns = "*"): this {
    this._selectColumns =
      columns === "*" ? [] : columns.split(",").map((c) => c.trim());
    return this; // return this → allows chaining
  }

  /** WHERE column = value */
  eq(column: string, value: unknown): this {
    this._filters.push({column, operator: "eq", value: String(value)});
    return this;
  }

  /** WHERE column != value */
  neq(column: string, value: unknown): this {
    this._filters.push({column, operator: "neq", value: String(value)});
    return this;
  }

  /** WHERE column > value */
  gt(column: string, value: unknown): this {
    this._filters.push({column, operator: "gt", value: String(value)});
    return this;
  }

  /** WHERE column >= value */
  gte(column: string, value: unknown): this {
    this._filters.push({column, operator: "gte", value: String(value)});
    return this;
  }

  /** WHERE column < value */
  lt(column: string, value: unknown): this {
    this._filters.push({column, operator: "lt", value: String(value)});
    return this;
  }

  /** WHERE column <= value */
  lte(column: string, value: unknown): this {
    this._filters.push({column, operator: "lte", value: String(value)});
    return this;
  }

  /**
   * WHERE column LIKE pattern (case-sensitive).
   * Use % as wildcard: .like("name", "%john%")
   */
  like(column: string, pattern: string): this {
    this._filters.push({column, operator: "like", value: pattern});
    return this;
  }

  /**
   * WHERE column ILIKE pattern (case-insensitive).
   * .ilike("email", "%@GMAIL.COM")
   */
  ilike(column: string, pattern: string): this {
    this._filters.push({column, operator: "ilike", value: pattern});
    return this;
  }

  /**
   * WHERE column IS NULL / IS NOT NULL
   *   .is("deleted_at", "null")
   *   .is("deleted_at", "not null")
   */
  is(column: string, value: "null" | "not null"): this {
    this._filters.push({
      column,
      operator: "is",
      value: value === "null" ? "null" : "not null",
    });
    return this;
  }

  /** ORDER BY column ASC|DESC */
  order(column: string, direction: "asc" | "desc" = "asc"): this {
    this._orderCol = column;
    this._orderDir = direction;
    return this;
  }

  /** LIMIT n — max rows to return */
  limit(n: number): this {
    this._limitVal = n;
    return this;
  }

  /** OFFSET n — skip first n rows (for pagination) */
  offset(n: number): this {
    this._offsetVal = n;
    return this;
  }

  // ── Write helpers ─────────────────────────────────────────────────────────

  /**
   * INSERT one row.
   * Switches method to POST and stores the body.
   *   .insert({ name: "Ada", age: 36 })
   */
  insert(data: Record<string, unknown>): this {
    this._method = "POST";
    this._body = data;
    return this;
  }

  /**
   * UPDATE a row.
   * Must be chained after .eq("id", rowId).
   *   .eq("id", "abc").update({ name: "Ada" })
   */
  update(data: Record<string, unknown>): this {
    this._method = "PATCH";
    this._body = data;
    return this;
  }

  /**
   * DELETE a row.
   * Must be chained after .eq("id", rowId).
   *   .eq("id", "abc").delete()
   */
  delete(): this {
    this._method = "DELETE";
    return this;
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * For PATCH/DELETE the API expects: /rest/:table/:id
   * So we require a filter like .eq("id", value) and pull that value out.
   */
  private getRowIdForMutation(): string {
    const idFilter = this._filters.find(
      (f) => f.column === "id" && f.operator === "eq",
    );

    if (!idFilter) {
      throw new Error(
        "Row ID filter is required for update and delete operations. update() and delete() methods must be preceded by an eq('id', value) filter.",
      );
    }

    return idFilter.value;
  }

  /**
   * Builds the final request URL from all stored options.
   *
   * GET example:
   *   /rest/users?select=id,name&status=eq.active&order=created_at.desc&limit=10
   *
   * PATCH/DELETE example:
   *   /rest/users/abc-123
   */
  private buildUrl(): string {
    const base = `${this.projectUrl}/rest/${this.table}`;

    // Mutations target a single row by id in the path
    if (this._method === "PATCH" || this._method === "DELETE") {
      return `${base}/${this.getRowIdForMutation()}`;
    }

    // Reads (and inserts) use query-string params
    const params = new URLSearchParams();

    if (this._selectColumns.length > 0) {
      params.set("select", this._selectColumns.join(","));
    }

    // Each filter → column=operator.value  e.g. age=gte.18
    for (const {column, operator, value} of this._filters) {
      params.set(column, `${operator}.${value}`);
    }

    if (this._orderCol) {
      params.set("order", `${this._orderCol}.${this._orderDir}`);
    }

    if (this._limitVal !== null) params.set("limit", String(this._limitVal));
    if (this._offsetVal !== null) params.set("offset", String(this._offsetVal));

    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }

  /**
   * Sends the HTTP request and returns { data, error }.
   * Never throws for HTTP/network errors — they become error: "...".
   */
  async execute(): Promise<QueryResult<T | T[]>> {
    try {
      const res = await fetch(this.buildUrl(), {
        method: this._method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        // Only send body for POST/PATCH
        body: this._body ? JSON.stringify(this._body) : undefined,
      });

      // Non-2xx → treat as error, try to read message from JSON body
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        return {
          data: null,
          error: err.message ?? `HTTP error ${res.status}`,
        };
      }

      // 204 No Content (e.g. successful DELETE with no body)
      if (res.status === 204) return {data: null, error: null};

      const data = (await res.json()) as T | T[];
      return {data, error: null};
    } catch (err: unknown) {
      // Network failure, CORS, etc.
      const message =
        err instanceof Error
          ? err.message
          : "Network error caught during query execution";
      return {data: null, error: message};
    }
  }

  /**
   * Makes the builder "thenable" so you can write:
   *   await client.from("users").select()
   * instead of:
   *   await client.from("users").select().execute()
   *
   * Any object with a .then() method is treated like a Promise by JS.
   */
  then<TResult1 = QueryResult<T | T[]>, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult<T | T[]>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}