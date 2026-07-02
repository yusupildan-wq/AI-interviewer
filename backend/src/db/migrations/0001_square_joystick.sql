CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"target_role" text DEFAULT 'full-stack' NOT NULL,
	"seniority" text DEFAULT 'mid-level' NOT NULL,
	"preferred_language" text DEFAULT 'typescript' NOT NULL,
	"target_companies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weak_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"interview_goal" text DEFAULT 'Prepare for realistic technical interviews.' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;