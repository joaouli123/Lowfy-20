
-- Add parent_comment_id column to forum_replies for nested replies
ALTER TABLE "forum_replies" ADD COLUMN "parent_comment_id" varchar;

-- Add self-referencing foreign key
ALTER TABLE "forum_replies" 
  ADD CONSTRAINT "forum_replies_parent_comment_id_forum_replies_id_fk" 
  FOREIGN KEY ("parent_comment_id") 
  REFERENCES "public"."forum_replies"("id") 
  ON DELETE CASCADE 
  ON UPDATE NO ACTION;
