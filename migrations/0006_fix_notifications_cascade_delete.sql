
-- Drop existing constraints
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_related_comment_id_post_comments_id_fk";
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_related_post_id_timeline_posts_id_fk";

-- Recreate with CASCADE for comments
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_comment_id_post_comments_id_fk" 
  FOREIGN KEY ("related_comment_id") REFERENCES "public"."post_comments"("id") ON DELETE CASCADE ON UPDATE no action;

-- Recreate with CASCADE for posts
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_post_id_timeline_posts_id_fk" 
  FOREIGN KEY ("related_post_id") REFERENCES "public"."timeline_posts"("id") ON DELETE CASCADE ON UPDATE no action;
