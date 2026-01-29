
-- Add parentCommentId to post_comments for threaded replies
ALTER TABLE "post_comments" ADD COLUMN "parent_comment_id" varchar;

-- Add timeline post references to notifications
ALTER TABLE "notifications" ADD COLUMN "related_post_id" varchar;
ALTER TABLE "notifications" ADD COLUMN "related_comment_id" varchar;

-- Add foreign keys
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_post_id_timeline_posts_id_fk" 
  FOREIGN KEY ("related_post_id") REFERENCES "public"."timeline_posts"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_comment_id_post_comments_id_fk" 
  FOREIGN KEY ("related_comment_id") REFERENCES "public"."post_comments"("id") ON DELETE cascade ON UPDATE no action;
