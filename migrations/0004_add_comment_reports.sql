
-- Add comment_reports table
CREATE TABLE IF NOT EXISTS "comment_reports" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "comment_id" varchar NOT NULL,
  "reporter_id" varchar NOT NULL,
  "reason" varchar NOT NULL,
  "description" text,
  "status" varchar DEFAULT 'pending',
  "created_at" timestamp DEFAULT now(),
  "reviewed_at" timestamp,
  "reviewed_by" varchar
);

ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_comment_id_post_comments_id_fk" 
  FOREIGN KEY ("comment_id") REFERENCES "public"."post_comments"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_reporter_id_users_id_fk" 
  FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_reviewed_by_users_id_fk" 
  FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "IDX_comment_reports_comment" ON "comment_reports" ("comment_id");
CREATE INDEX IF NOT EXISTS "IDX_comment_reports_reporter" ON "comment_reports" ("reporter_id");
