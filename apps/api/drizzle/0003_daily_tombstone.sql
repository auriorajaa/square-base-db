ALTER TABLE "query_history" ADD COLUMN "execution_time_ms" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "query_history" ADD COLUMN "row_count" integer NOT NULL;