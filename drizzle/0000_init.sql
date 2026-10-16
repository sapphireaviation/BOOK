CREATE SCHEMA IF NOT EXISTS "booking";
--> statement-breakpoint
CREATE TYPE "booking"."user_role" AS ENUM('traveler', 'host', 'admin');--> statement-breakpoint
CREATE TYPE "booking"."cancellation_policy" AS ENUM('flexible', 'moderate', 'strict', 'non_refundable');--> statement-breakpoint
CREATE TYPE "booking"."listing_kind" AS ENUM('stay', 'experience', 'transport');--> statement-breakpoint
CREATE TYPE "booking"."listing_status" AS ENUM('draft', 'published', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "booking"."property_type" AS ENUM('hotel', 'guesthouse', 'homestay', 'apartment', 'house', 'villa', 'hostel', 'resort', 'cabin', 'other');--> statement-breakpoint
CREATE TYPE "booking"."booking_kind" AS ENUM('stay', 'flight');--> statement-breakpoint
CREATE TYPE "booking"."booking_status" AS ENUM('draft', 'pending_payment', 'confirmed', 'completed', 'cancelled', 'refunded', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "booking"."payment_provider" AS ENUM('razorpay', 'stripe', 'manual', 'test');--> statement-breakpoint
CREATE TYPE "booking"."payment_status" AS ENUM('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "booking"."payout_status" AS ENUM('owed', 'scheduled', 'paid', 'cancelled');--> statement-breakpoint
CREATE TABLE "booking"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "booking"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "booking"."user_role" DEFAULT 'traveler' NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "booking"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."airports" (
	"iata" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"country_code" text NOT NULL,
	"country_name" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"time_zone" text,
	"popularity" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."destinations" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"country_code" text NOT NULL,
	"country_name" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"radius_km" integer DEFAULT 30 NOT NULL,
	"nearest_airports" text[] DEFAULT '{}' NOT NULL,
	"summary" text,
	"body" text,
	"hero_image" text,
	"faqs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."flight_routes" (
	"slug" text PRIMARY KEY NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"summary" text,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."host_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"about" text DEFAULT '' NOT NULL,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"payout_reference" text,
	"payout_method" text,
	"tax_id" text,
	"verified" boolean DEFAULT false NOT NULL,
	"response_minutes" integer,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."listing_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"url" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"width" integer,
	"height" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."listing_units" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"max_guests" integer DEFAULT 2 NOT NULL,
	"beds" text DEFAULT '' NOT NULL,
	"base_price" integer NOT NULL,
	"extra_guest_price" integer DEFAULT 0 NOT NULL,
	"included_guests" integer DEFAULT 2 NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"amenities" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."listings" (
	"id" text PRIMARY KEY NOT NULL,
	"host_id" text NOT NULL,
	"kind" "booking"."listing_kind" DEFAULT 'stay' NOT NULL,
	"status" "booking"."listing_status" DEFAULT 'draft' NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"property_type" "booking"."property_type" DEFAULT 'homestay' NOT NULL,
	"address_line" text,
	"locality" text,
	"city" text NOT NULL,
	"region" text,
	"postal_code" text,
	"country_code" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"destination_slug" text,
	"max_guests" integer DEFAULT 2 NOT NULL,
	"bedrooms" integer DEFAULT 1 NOT NULL,
	"beds" integer DEFAULT 1 NOT NULL,
	"bathrooms" real DEFAULT 1 NOT NULL,
	"amenities" text[] DEFAULT '{}' NOT NULL,
	"house_rules" text DEFAULT '' NOT NULL,
	"check_in_from" time DEFAULT '14:00' NOT NULL,
	"check_out_until" time DEFAULT '11:00' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"from_price" integer DEFAULT 0 NOT NULL,
	"cleaning_fee" integer DEFAULT 0 NOT NULL,
	"tax_bps" integer DEFAULT 0 NOT NULL,
	"min_nights" integer DEFAULT 1 NOT NULL,
	"max_nights" integer DEFAULT 30 NOT NULL,
	"instant_book" boolean DEFAULT true NOT NULL,
	"cancellation_policy" "booking"."cancellation_policy" DEFAULT 'moderate' NOT NULL,
	"contact_phone" text,
	"contact_email" text,
	"rating_avg" real DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "booking"."unit_inventory" (
	"unit_id" text NOT NULL,
	"date" date NOT NULL,
	"booked" integer DEFAULT 0 NOT NULL,
	"total" integer,
	"price" integer,
	"closed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "unit_inventory_unit_id_date_pk" PRIMARY KEY("unit_id","date")
);
--> statement-breakpoint
CREATE TABLE "booking"."wishlists" (
	"user_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlists_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "booking"."bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"kind" "booking"."booking_kind" NOT NULL,
	"status" "booking"."booking_status" DEFAULT 'draft' NOT NULL,
	"user_id" text,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"currency" text NOT NULL,
	"total" integer NOT NULL,
	"price_lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"access_token" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "booking"."flight_bookings" (
	"booking_id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"offer_id" text NOT NULL,
	"provider_order_id" text,
	"airline_reference" text,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"depart_at" timestamp with time zone NOT NULL,
	"return_at" timestamp with time zone,
	"slices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"passengers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider_total" integer NOT NULL,
	"provider_currency" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."payment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" "booking"."payment_provider" NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."payments" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"provider" "booking"."payment_provider" NOT NULL,
	"status" "booking"."payment_status" DEFAULT 'created' NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"provider_order_id" text,
	"provider_payment_id" text,
	"method" text,
	"failure_reason" text,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"host_id" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "booking"."payout_status" DEFAULT 'owed' NOT NULL,
	"release_on" date NOT NULL,
	"paid_at" timestamp with time zone,
	"provider_transfer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"booking_id" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"provider_refund_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."stay_bookings" (
	"booking_id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"host_id" text NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"nights" integer NOT NULL,
	"units" integer DEFAULT 1 NOT NULL,
	"adults" integer NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"guest_note" text,
	"cancellation_policy" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"user_id" text,
	"author_name" text NOT NULL,
	"rating" integer NOT NULL,
	"cleanliness" integer,
	"accuracy" integer,
	"location" integer,
	"value" integer,
	"body" text DEFAULT '' NOT NULL,
	"host_reply" text,
	"stay_month" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."email_log" (
	"id" text PRIMARY KEY NOT NULL,
	"to" text NOT NULL,
	"template" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"provider_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"tokens" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking"."search_log" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"query" jsonb NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"cheapest" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "booking"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "booking"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."flight_routes" ADD CONSTRAINT "flight_routes_origin_airports_iata_fk" FOREIGN KEY ("origin") REFERENCES "booking"."airports"("iata") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."flight_routes" ADD CONSTRAINT "flight_routes_destination_airports_iata_fk" FOREIGN KEY ("destination") REFERENCES "booking"."airports"("iata") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."host_profiles" ADD CONSTRAINT "host_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "booking"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "booking"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."listing_units" ADD CONSTRAINT "listing_units_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "booking"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."listings" ADD CONSTRAINT "listings_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "booking"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."unit_inventory" ADD CONSTRAINT "unit_inventory_unit_id_listing_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "booking"."listing_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."wishlists" ADD CONSTRAINT "wishlists_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "booking"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."wishlists" ADD CONSTRAINT "wishlists_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "booking"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."bookings" ADD CONSTRAINT "bookings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "booking"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."flight_bookings" ADD CONSTRAINT "flight_bookings_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "booking"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "booking"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."payouts" ADD CONSTRAINT "payouts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "booking"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."payouts" ADD CONSTRAINT "payouts_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "booking"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "booking"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."refunds" ADD CONSTRAINT "refunds_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "booking"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."stay_bookings" ADD CONSTRAINT "stay_bookings_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "booking"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."stay_bookings" ADD CONSTRAINT "stay_bookings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "booking"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."stay_bookings" ADD CONSTRAINT "stay_bookings_unit_id_listing_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "booking"."listing_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."stay_bookings" ADD CONSTRAINT "stay_bookings_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "booking"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "booking"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."reviews" ADD CONSTRAINT "reviews_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "booking"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking"."reviews" ADD CONSTRAINT "reviews_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "booking"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "booking"."account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "booking"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "airports_city_idx" ON "booking"."airports" USING btree ("city");--> statement-breakpoint
CREATE INDEX "airports_country_idx" ON "booking"."airports" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "destinations_country_idx" ON "booking"."destinations" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "listing_photos_listing_idx" ON "booking"."listing_photos" USING btree ("listing_id","position");--> statement-breakpoint
CREATE INDEX "listing_units_listing_idx" ON "booking"."listing_units" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listings_host_idx" ON "booking"."listings" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "listings_status_city_idx" ON "booking"."listings" USING btree ("status","city");--> statement-breakpoint
CREATE INDEX "listings_destination_idx" ON "booking"."listings" USING btree ("destination_slug");--> statement-breakpoint
CREATE INDEX "listings_geo_idx" ON "booking"."listings" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "bookings_user_idx" ON "booking"."bookings" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "booking"."bookings" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "bookings_email_idx" ON "booking"."bookings" USING btree ("contact_email");--> statement-breakpoint
CREATE INDEX "flight_bookings_order_idx" ON "booking"."flight_bookings" USING btree ("provider_order_id");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "booking"."payments" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_order_idx" ON "booking"."payments" USING btree ("provider","provider_order_id");--> statement-breakpoint
CREATE INDEX "payouts_host_idx" ON "booking"."payouts" USING btree ("host_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_booking_idx" ON "booking"."payouts" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "refunds_booking_idx" ON "booking"."refunds" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "stay_bookings_listing_idx" ON "booking"."stay_bookings" USING btree ("listing_id","check_in");--> statement-breakpoint
CREATE INDEX "stay_bookings_host_idx" ON "booking"."stay_bookings" USING btree ("host_id","check_in");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_booking_idx" ON "booking"."reviews" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "reviews_listing_idx" ON "booking"."reviews" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "search_log_kind_created_idx" ON "booking"."search_log" USING btree ("kind","created_at");