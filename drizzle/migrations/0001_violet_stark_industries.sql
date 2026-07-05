CREATE TYPE "public"."line_notification_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "line_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"line_user_id" text NOT NULL,
	"message_text" text NOT NULL,
	"status" "line_notification_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "line_notifications" ADD CONSTRAINT "line_notifications_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "line_notifications_status_idx" ON "line_notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "line_notifications_loan_id_idx" ON "line_notifications" USING btree ("loan_id");