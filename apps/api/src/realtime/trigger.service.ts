import { BadRequestException, Injectable } from "@nestjs/common";
import { DrizzleService } from "../db/drizzle.service.js";

@Injectable()
export class TriggerService {
  constructor(private drizzle: DrizzleService) {}

  /**
   * Checks that a name is safe to use in dynamic SQL.
   * Only allows: letter/underscore first, then letters, numbers, underscores.
   * Stops SQL injection if someone passes a weird table/schema name.
   */
  private assertSafeIdentifier(name: string, label: string): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new BadRequestException(
        `${label} must be a valid identifier (alphanumeric and underscores, cannot start with a number)`,
      );
    }
  }

  /**
   * Builds a unique channel name for Postgres LISTEN/NOTIFY.
   *
   * Example:
   *   projectId  = "a1b2-c3d4-e5f6"
   *   tableName  = "messages"
   *   result     = "project_a1b2_c3d4_e5f6_messages"
   *
   * Hyphens in UUID are replaced with underscores because
   * channel names should be simple identifiers.
   */
  static channelName(projectId: string, tableName: string): string {
    return `project_${projectId.replace(/-/g, "_")}_${tableName}`;
  }

  /**
   * Turns on real-time for one table.
   *
   * What happens:
   * 1. Create a Postgres FUNCTION that runs on every row change
   * 2. That function builds a JSON payload and calls pg_notify(...)
   * 3. Attach a TRIGGER so the function runs AFTER INSERT/UPDATE/DELETE
   *
   * Your app can then LISTEN on the channel and receive those notifications.
   */
  async enableRealtime(
    dbSchema: string,
    projectId: string,
    tableName: string,
  ): Promise<void> {
    // Make sure names are safe before putting them into SQL strings
    this.assertSafeIdentifier(dbSchema, "schema name");
    this.assertSafeIdentifier(tableName, "table name");

    // Channel = where notifications are sent (LISTEN side uses the same name)
    const channel = TriggerService.channelName(projectId, tableName);

    // Function name stored inside the project's schema
    // e.g. "project_abc_messages_notify"
    const fnName = `${channel}_notify`;

    /**
     * STEP 1 — Create (or replace) the trigger function
     *
     * Postgres trigger function rules:
     * - Must return TRIGGER
     * - Has special vars: TG_OP, TG_TABLE_NAME, NEW, OLD
     *   TG_OP        = 'INSERT' | 'UPDATE' | 'DELETE'
     *   TG_TABLE_NAME = name of the table that fired the trigger
     *   NEW          = the new row (INSERT / UPDATE)
     *   OLD          = the old row (UPDATE / DELETE)
     *
     * pg_notify(channel, payload):
     *   Sends a text message on that channel to every session that is LISTENing.
     */
    await this.drizzle.db.execute(`
      CREATE OR REPLACE FUNCTION "${dbSchema}"."${fnName}"()
      RETURNS TRIGGER AS $$
      DECLARE
        payload JSON;   -- variable that will hold the JSON we send
      BEGIN
        -- DELETE: row is gone, so we only have OLD
        IF TG_OP = 'DELETE' THEN
          payload = json_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'record', row_to_json(OLD),
            'oldRecord', row_to_json(OLD),
            'projectId', '${projectId}',
            'timestamp', now()::text
          );
          -- Send the JSON (as text) to everyone listening on this channel
          PERFORM pg_notify('${channel}', payload::text);
          RETURN OLD;   -- required for DELETE triggers

        -- UPDATE: we have both NEW (after) and OLD (before)
        ELSIF TG_OP = 'UPDATE' THEN
          payload = json_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'record', row_to_json(NEW),
            'oldRecord', row_to_json(OLD),
            'projectId', '${projectId}',
            'timestamp', now()::text
          );
          PERFORM pg_notify('${channel}', payload::text);
          RETURN NEW;   -- required for UPDATE triggers

        -- INSERT (and any other case): only NEW exists
        ELSE
          payload = json_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'record', row_to_json(NEW),
            'projectId', '${projectId}',
            'timestamp', now()::text
          );
          PERFORM pg_notify('${channel}', payload::text);
          RETURN NEW;   -- required for INSERT triggers
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);

    /**
     * STEP 2 — Attach the trigger to the table
     *
     * DROP first so re-running enableRealtime is safe (idempotent).
     *
     * AFTER INSERT OR UPDATE OR DELETE
     *   → fire after the row change is done
     * FOR EACH ROW
     *   → run once per changed row (not once per statement)
     * EXECUTE FUNCTION ...
     *   → call the function we created above
     */
    await this.drizzle.db.execute(`
      DROP TRIGGER IF EXISTS "${tableName}_realtime_trigger"
      ON "${dbSchema}"."${tableName}";

      CREATE TRIGGER "${tableName}_realtime_trigger"
      AFTER INSERT OR UPDATE OR DELETE
      ON "${dbSchema}"."${tableName}"
      FOR EACH ROW
      EXECUTE FUNCTION "${dbSchema}"."${fnName}"();
    `);
  }

  /**
   * Turns off real-time for a table.
   * Only drops the trigger. The notify function can stay (harmless if unused).
   */
  async disableRealtime(dbSchema: string, tableName: string): Promise<void> {
    this.assertSafeIdentifier(dbSchema, "schema name");
    this.assertSafeIdentifier(tableName, "table name");

    await this.drizzle.db.execute(`
      DROP TRIGGER IF EXISTS "${tableName}_realtime_trigger"
      ON "${dbSchema}"."${tableName}";
    `);
  }
}
