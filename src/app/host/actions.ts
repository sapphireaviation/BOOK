"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/host/action-state";
import { formatMoney } from "@/lib/money";
import { formatDay } from "@/lib/dates";
import { runAction } from "@/server/host/action-helpers";
import { updateCalendarRange } from "@/server/host/calendar";
import {
  createDraftListing,
  publishListing,
  unpublishListing,
  updateAmenities,
  updateBasics,
  updateCurrency,
  updateLocation,
  updatePolicies,
} from "@/server/host/listings";
import { deletePhoto, movePhoto, updatePhotoAlt } from "@/server/host/photos";
import { becomeHost, updateHostProfile } from "@/server/host/profile";
import { createUnit, deleteUnit, updateUnit } from "@/server/host/units";
import {
  amenitiesSchema,
  basicsSchema,
  calendarSchema,
  currencySchema,
  locationSchema,
  newListingSchema,
  photoAltSchema,
  policiesSchema,
  profileSchema,
  unitSchema,
} from "@/server/host/schemas";
import { parseMoneyInput } from "@/server/host/rules";

const empty = z.object({});
const listingId = z.string().regex(/^lst_[a-z0-9]+$/);
const childId = z.string().regex(/^[a-z]{3}_[a-z0-9]+$/);

/** Public pages read listings through cache tags; the host should see their own change at once. */
function expireListing(id: string) {
  updateTag(`listing:${id}`);
  updateTag("listings");
}

export async function startHosting(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction({
    roles: ["traveler", "host", "admin"],
    schema: empty,
    formData,
    ok: "You are now a host",
    run: async (actor) => {
      await becomeHost(actor.userId);
    },
  });
  if (result.status === "ok") redirect("/host/listings/new");
  return result;
}

export async function createListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction({
    schema: newListingSchema,
    formData,
    ok: "Listing created",
    run: async (actor, input) => {
      id = await createDraftListing(actor, input);
    },
  });
  if (result.status === "ok" && id) redirect(`/host/listings/${id}`);
  return result;
}

export async function saveBasics(id: string, _prev: ActionState, formData: FormData) {
  listingId.parse(id);
  return runAction({
    schema: basicsSchema,
    formData,
    ok: "Basics saved",
    run: async (actor, input) => {
      await updateBasics(actor, id, input);
      expireListing(id);
    },
  });
}

export async function saveLocation(id: string, _prev: ActionState, formData: FormData) {
  listingId.parse(id);
  return runAction({
    schema: locationSchema,
    formData,
    ok: "Location saved",
    run: async (actor, input) => {
      await updateLocation(actor, id, input);
      expireListing(id);
    },
  });
}

export async function saveAmenities(id: string, _prev: ActionState, formData: FormData) {
  listingId.parse(id);
  return runAction({
    schema: amenitiesSchema,
    formData,
    arrays: ["amenities"],
    ok: "Amenities saved",
    run: async (actor, input) => {
      await updateAmenities(actor, id, input);
      expireListing(id);
    },
  });
}

export async function savePolicies(id: string, _prev: ActionState, formData: FormData) {
  listingId.parse(id);
  return runAction({
    schema: policiesSchema,
    formData,
    ok: "Policies saved",
    run: async (actor, input) => {
      await updatePolicies(actor, id, input);
      expireListing(id);
    },
  });
}

export async function saveCurrency(id: string, _prev: ActionState, formData: FormData) {
  listingId.parse(id);
  return runAction({
    schema: currencySchema,
    formData,
    ok: "Currency changed",
    run: async (actor, input) => {
      await updateCurrency(actor, id, input);
      expireListing(id);
      return `Currency changed to ${input.currency}`;
    },
  });
}

export async function saveUnit(id: string, unitId: string | null, _prev: ActionState, formData: FormData) {
  listingId.parse(id);
  if (unitId) childId.parse(unitId);
  return runAction({
    schema: unitSchema,
    formData,
    ok: unitId ? "Room saved" : "Room added",
    run: async (actor, input) => {
      if (unitId) await updateUnit(actor, id, unitId, input);
      else await createUnit(actor, id, input);
      expireListing(id);
    },
  });
}

export async function removeUnit(id: string, unitId: string, _prev: ActionState, formData: FormData) {
  listingId.parse(id);
  childId.parse(unitId);
  return runAction({
    schema: empty,
    formData,
    ok: "Room deleted",
    run: async (actor) => {
      await deleteUnit(actor, id, unitId);
      expireListing(id);
    },
  });
}

export async function savePhotoAlt(id: string, photoId: string, _prev: ActionState, formData: FormData) {
  listingId.parse(id);
  childId.parse(photoId);
  return runAction({
    schema: photoAltSchema,
    formData,
    ok: "Description saved",
    run: async (actor, input) => {
      await updatePhotoAlt(actor, id, photoId, input.alt);
      expireListing(id);
    },
  });
}

const moveSchema = z.object({ direction: z.enum(["up", "down", "first"]) });

export async function arrangePhoto(id: string, photoId: string, _prev: ActionState, formData: FormData) {
  listingId.parse(id);
  childId.parse(photoId);
  return runAction({
    schema: moveSchema,
    formData,
    ok: "Photo moved",
    run: async (actor, input) => {
      await movePhoto(actor, id, photoId, input.direction);
      expireListing(id);
      return input.direction === "first" ? "Photo moved to cover" : "Photo moved";
    },
  });
}

export async function removePhoto(id: string, photoId: string, _prev: ActionState, formData: FormData) {
  listingId.parse(id);
  childId.parse(photoId);
  return runAction({
    schema: empty,
    formData,
    ok: "Photo deleted",
    run: async (actor) => {
      await deletePhoto(actor, id, photoId);
      expireListing(id);
    },
  });
}

export async function updateCalendar(id: string, unitId: string, currency: string, _prev: ActionState, formData: FormData) {
  listingId.parse(id);
  childId.parse(unitId);
  return runAction({
    schema: calendarSchema,
    formData,
    ok: "Calendar updated",
    run: async (actor, input) => {
      const { days } = await updateCalendarRange(actor, id, unitId, input);
      const range = input.from === input.to ? formatDay(input.from) : `${formatDay(input.from < input.to ? input.from : input.to)} to ${formatDay(input.from < input.to ? input.to : input.from)}`;
      const nights = `${days} ${days === 1 ? "night" : "nights"}`;
      switch (input.kind) {
        case "price": {
          const p = parseMoneyInput(input.price, currency);
          return `Price set for ${nights}, ${range}${p.ok && p.value ? `: ${formatMoney({ amount: p.value, currency })}` : ""}`;
        }
        case "reset_price":
          return `Price reset to the room's base price for ${nights}, ${range}`;
        case "close":
          return `Closed ${nights}, ${range}`;
        case "open":
          return `Reopened ${nights}, ${range}`;
        case "total":
          return `Rooms available set for ${nights}, ${range}`;
      }
    },
  });
}

const publishSchema = z.object({ intent: z.enum(["publish", "unpublish"]) });

export async function setPublished(id: string, _prev: ActionState, formData: FormData) {
  listingId.parse(id);
  return runAction({
    schema: publishSchema,
    formData,
    ok: "Listing published",
    run: async (actor, input) => {
      if (input.intent === "publish") await publishListing(actor, id);
      else await unpublishListing(actor, id);
      expireListing(id);
      return input.intent === "publish" ? "Listing published" : "Listing unpublished";
    },
  });
}

export async function saveProfile(_prev: ActionState, formData: FormData) {
  return runAction({
    schema: profileSchema,
    formData,
    ok: "Profile saved",
    run: async (actor, input) => {
      await updateHostProfile(actor, input);
    },
  });
}
