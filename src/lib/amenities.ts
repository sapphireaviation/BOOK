/** Amenity catalogue. Keys are stored on listings and units; labels are what people see. */
export const amenityGroups = [
  {
    group: "Essentials",
    items: [
      { key: "wifi", label: "Wi-Fi" },
      { key: "ac", label: "Air conditioning" },
      { key: "heating", label: "Heating" },
      { key: "hot_water", label: "Hot water" },
      { key: "power_backup", label: "Power backup" },
      { key: "workspace", label: "Desk for work" },
      { key: "tv", label: "TV" },
      { key: "washer", label: "Washing machine" },
    ],
  },
  {
    group: "Food",
    items: [
      { key: "kitchen", label: "Kitchen" },
      { key: "breakfast", label: "Breakfast included" },
      { key: "restaurant", label: "Restaurant on site" },
      { key: "fridge", label: "Fridge" },
    ],
  },
  {
    group: "Outdoors and leisure",
    items: [
      { key: "pool", label: "Pool" },
      { key: "garden", label: "Garden" },
      { key: "balcony", label: "Balcony" },
      { key: "beach_access", label: "Beach access" },
      { key: "mountain_view", label: "Mountain view" },
      { key: "sea_view", label: "Sea view" },
      { key: "gym", label: "Gym" },
    ],
  },
  {
    group: "Getting there",
    items: [
      { key: "parking", label: "Free parking" },
      { key: "airport_pickup", label: "Airport pickup on request" },
      { key: "ev_charging", label: "EV charging" },
    ],
  },
  {
    group: "Access and family",
    items: [
      { key: "step_free", label: "Step-free entrance" },
      { key: "lift", label: "Lift" },
      { key: "crib", label: "Cot for babies" },
      { key: "pets", label: "Pets allowed" },
    ],
  },
  {
    group: "Safety",
    items: [
      { key: "smoke_alarm", label: "Smoke alarm" },
      { key: "first_aid", label: "First aid kit" },
      { key: "cctv_outside", label: "Security camera outside" },
      { key: "staff_24h", label: "Staff on site 24 hours" },
    ],
  },
] as const;

export type AmenityKey = (typeof amenityGroups)[number]["items"][number]["key"];

const labels = new Map<string, string>(amenityGroups.flatMap((g) => g.items.map((i) => [i.key, i.label] as const)));

export function amenityLabel(key: string) {
  return labels.get(key) ?? key.replace(/_/g, " ");
}

export const amenityKeys = [...labels.keys()];

export const propertyTypeLabels: Record<string, string> = {
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  homestay: "Homestay",
  apartment: "Apartment",
  house: "House",
  villa: "Villa",
  hostel: "Hostel",
  resort: "Resort",
  cabin: "Cabin",
  other: "Other",
};

export const cancellationPolicyText: Record<string, { label: string; summary: string }> = {
  flexible: { label: "Flexible", summary: "Full refund if you cancel at least 24 hours before check in." },
  moderate: { label: "Moderate", summary: "Full refund up to 5 days before check in. After that, 50% back." },
  strict: { label: "Strict", summary: "50% back if you cancel at least 7 days before check in. No refund after that." },
  non_refundable: { label: "Non-refundable", summary: "No refund if you cancel." },
};
