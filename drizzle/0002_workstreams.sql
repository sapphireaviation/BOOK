ALTER TYPE "public"."payment_provider" ADD VALUE 'test';--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;