CREATE TYPE "public"."document_type" AS ENUM('id_card', 'title_deed', 'contract', 'other');--> statement-breakpoint
CREATE TYPE "public"."interest_type" AS ENUM('flat_daily', 'flat_monthly', 'effective_daily', 'effective_monthly');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('active', 'upcoming', 'overdue', 'closed', 'npl');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'debtor');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"doc_type" "document_type" NOT NULL,
	"file_name" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"mime_type" text,
	"file_size_bytes" numeric(10, 0),
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"principal" numeric(15, 2) NOT NULL,
	"outstanding_principal" numeric(15, 2) NOT NULL,
	"accrued_interest" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total_interest_collected" numeric(15, 2) DEFAULT '0' NOT NULL,
	"interest_rate" numeric(8, 4) NOT NULL,
	"interest_type" "interest_type" NOT NULL,
	"start_date" date NOT NULL,
	"due_date" date NOT NULL,
	"last_interest_calc_date" date,
	"status" "loan_status" DEFAULT 'active' NOT NULL,
	"note" text,
	"bank_account_name" text,
	"bank_account_number" text,
	"bank_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"notification_type" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_date" date NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"payment_date" date NOT NULL,
	"amount_paid" numeric(15, 2) NOT NULL,
	"interest_portion" numeric(15, 2) NOT NULL,
	"principal_portion" numeric(15, 2) NOT NULL,
	"remaining_principal" numeric(15, 2) NOT NULL,
	"accrued_interest_before" numeric(15, 2) NOT NULL,
	"accrued_interest_after" numeric(15, 2) NOT NULL,
	"note" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"full_name" text,
	"email" text,
	"phone" text,
	"line_user_id" text,
	"role" "user_role" DEFAULT 'debtor' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_loan_id_idx" ON "documents" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "loans_user_id_idx" ON "loans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "loans_status_idx" ON "loans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loans_due_date_idx" ON "loans" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "loans_due_date_status_idx" ON "loans" USING btree ("due_date","status");--> statement-breakpoint
CREATE INDEX "notification_logs_loan_id_idx" ON "notification_logs" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "notification_logs_sent_date_type_idx" ON "notification_logs" USING btree ("sent_date","notification_type");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_logs_idempotency_idx" ON "notification_logs" USING btree ("loan_id","sent_date","notification_type");--> statement-breakpoint
CREATE INDEX "payments_loan_id_idx" ON "payments" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "payments_payment_date_idx" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_idx" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");