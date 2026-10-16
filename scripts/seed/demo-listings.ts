import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { hostProfiles, listingPhotos, listings, listingUnits, user } from "../../src/db/schema";
import type * as schema from "../../src/db/schema";
import { toMinor } from "../../src/lib/money";

type SeedDb = PostgresJsDatabase<typeof schema>;

/**
 * Sample listings for local development and preview deployments. Every row is marked `is_demo`, shows a
 * "Sample listing" badge, has no reviews, and uses generated illustrations from `public/demo/`.
 * The seed refuses to run when NODE_ENV is production.
 */

export const DEMO_HOST_ID = "usr_demo_host";

type PropertyType = "hotel" | "guesthouse" | "homestay" | "apartment" | "house" | "villa" | "hostel" | "resort" | "cabin" | "other";
type Policy = "flexible" | "moderate" | "strict" | "non_refundable";

export type Scene =
  | "beach"
  | "mountain"
  | "heritage"
  | "lake"
  | "river"
  | "tea"
  | "backwater"
  | "city"
  | "desert"
  | "boulders"
  | "tropical";

type DemoUnit = {
  name: string;
  /** Nightly price in major units of the listing currency. */
  price: number;
  maxGuests: number;
  beds: string;
  quantity?: number;
  includedGuests?: number;
  /** Per extra guest per night, major units. */
  extraGuest?: number;
  description?: string;
};

export type DemoListing = {
  key: string;
  destination: string;
  scene: Scene;
  title: string;
  type: PropertyType;
  locality: string;
  city: string;
  region: string;
  countryCode: string;
  currency: string;
  lat: number;
  lng: number;
  summary: string;
  description: string;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  amenities: string[];
  policy: Policy;
  /** Basis points. */
  tax: number;
  /** Major units. */
  cleaning?: number;
  instantBook?: boolean;
  minNights?: number;
  checkIn?: string;
  checkOut?: string;
  rules?: string;
  units: DemoUnit[];
};

const RULES_HOME = "No smoking indoors.\nQuiet hours from 22:00 to 07:00.\nNo parties or events.";
const RULES_ID = "Every adult guest shows a government photo ID at check in.\nNo smoking indoors.\nQuiet hours from 22:00 to 07:00.";
const RULES_HOSTEL = "Every guest shows a government photo ID at check in.\nGuests must be 18 or older.\nLights out in dorms at 23:00.\nNo smoking indoors.";

export const demoListings: DemoListing[] = [
  // Goa
  {
    key: "goa-calangute-guesthouse",
    destination: "goa",
    scene: "beach",
    title: "Sea-facing rooms in a Calangute guesthouse",
    type: "guesthouse",
    locality: "Calangute",
    city: "Calangute",
    region: "Goa",
    countryCode: "IN",
    currency: "INR",
    lat: 15.544,
    lng: 73.763,
    summary: "Eight rooms on a lane a short walk from Calangute beach, with breakfast included.",
    description:
      "A three storey guesthouse on a lane off the Calangute to Baga road. The double rooms have a balcony and the family rooms sleep four. Breakfast is served on the ground floor from 08:00 to 10:30.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["wifi", "ac", "hot_water", "balcony", "sea_view", "breakfast", "parking", "power_backup"],
    policy: "moderate",
    tax: 500,
    rules: RULES_ID,
    units: [
      { name: "Double room with balcony", price: 3200, maxGuests: 2, beds: "1 double bed", quantity: 4 },
      { name: "Family room", price: 4800, maxGuests: 4, beds: "1 double bed, 2 single beds", quantity: 2, extraGuest: 600 },
    ],
  },
  {
    key: "goa-assagao-house",
    destination: "goa",
    scene: "beach",
    title: "Portuguese-era house with a garden in Assagao",
    type: "house",
    locality: "Assagao",
    city: "Assagao",
    region: "Goa",
    countryCode: "IN",
    currency: "INR",
    lat: 15.596,
    lng: 73.772,
    summary: "A three bedroom family house with a walled garden, 10 minutes by road from Anjuna beach.",
    description:
      "The whole house is yours: three bedrooms with their own bathrooms, a kitchen, a covered verandah and a walled garden. The house is in a quiet part of Assagao village, so a scooter or car is useful.",
    bedrooms: 3,
    beds: 3,
    bathrooms: 3,
    amenities: ["wifi", "ac", "kitchen", "garden", "parking", "washer", "workspace", "hot_water"],
    policy: "strict",
    tax: 1800,
    cleaning: 1500,
    instantBook: false,
    minNights: 2,
    rules: RULES_HOME,
    units: [{ name: "Entire house", price: 14500, maxGuests: 6, beds: "3 double beds", includedGuests: 4, extraGuest: 1000 }],
  },
  {
    key: "goa-palolem-huts",
    destination: "goa",
    scene: "beach",
    title: "Beach huts on Palolem",
    type: "cabin",
    locality: "Palolem",
    city: "Canacona",
    region: "Goa",
    countryCode: "IN",
    currency: "INR",
    lat: 15.01,
    lng: 74.023,
    summary: "Simple wooden huts set back from the sand at the south end of Palolem beach.",
    description:
      "Six huts with a double bed, a fan and a private bathroom with hot water. There is a small restaurant at the front. The huts are open from October to May.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["beach_access", "hot_water", "restaurant", "sea_view"],
    policy: "flexible",
    tax: 500,
    rules: RULES_ID,
    units: [{ name: "Beach hut", price: 2400, maxGuests: 2, beds: "1 double bed", quantity: 6 }],
  },
  {
    key: "goa-candolim-flat",
    destination: "goa",
    scene: "beach",
    title: "Two-bedroom flat with a pool in Candolim",
    type: "apartment",
    locality: "Candolim",
    city: "Candolim",
    region: "Goa",
    countryCode: "IN",
    currency: "INR",
    lat: 15.518,
    lng: 73.768,
    summary: "A second floor flat in a gated building with a shared pool, about 800 metres from the beach.",
    description:
      "Two bedrooms, a living room with a sofa bed and a full kitchen. The building has a lift, a shared pool and covered parking. Shops and restaurants are on the main Candolim road.",
    bedrooms: 2,
    beds: 3,
    bathrooms: 2,
    amenities: ["wifi", "ac", "kitchen", "pool", "lift", "parking", "washer", "tv"],
    policy: "moderate",
    tax: 500,
    cleaning: 800,
    rules: RULES_HOME,
    units: [{ name: "Entire flat", price: 6800, maxGuests: 5, beds: "2 double beds, 1 sofa bed", includedGuests: 4, extraGuest: 700 }],
  },

  // Manali
  {
    key: "manali-old-manali-cottage",
    destination: "manali",
    scene: "mountain",
    title: "Wooden cottage in Old Manali",
    type: "cabin",
    locality: "Old Manali",
    city: "Manali",
    region: "Himachal Pradesh",
    countryCode: "IN",
    currency: "INR",
    lat: 32.255,
    lng: 77.184,
    summary: "A two room cottage above Old Manali village with a wood stove and a view of the valley.",
    description:
      "The cottage has a bedroom, a living room with a daybed, a small kitchen and a bathroom with a geyser. It is a 10 minute uphill walk from the village road. The host lives in the house next door.",
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    amenities: ["heating", "hot_water", "kitchen", "mountain_view", "wifi", "parking"],
    policy: "moderate",
    tax: 500,
    cleaning: 500,
    rules: RULES_HOME,
    units: [{ name: "Entire cottage", price: 4500, maxGuests: 4, beds: "1 double bed, 1 daybed", includedGuests: 2, extraGuest: 500 }],
  },
  {
    key: "manali-vashisht-homestay",
    destination: "manali",
    scene: "mountain",
    title: "Homestay rooms with valley views in Vashisht",
    type: "homestay",
    locality: "Vashisht",
    city: "Manali",
    region: "Himachal Pradesh",
    countryCode: "IN",
    currency: "INR",
    lat: 32.264,
    lng: 77.188,
    summary: "Four rooms in a family home in Vashisht, near the hot spring temple.",
    description:
      "The family lives on the ground floor and the guest rooms are upstairs. Breakfast is cooked by the hosts. The Vashisht hot springs are a five minute walk away.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["heating", "hot_water", "breakfast", "mountain_view", "wifi"],
    policy: "flexible",
    tax: 0,
    rules: RULES_ID,
    units: [
      { name: "Double room", price: 2200, maxGuests: 2, beds: "1 double bed", quantity: 3 },
      { name: "Triple room", price: 2900, maxGuests: 3, beds: "1 double bed, 1 single bed", quantity: 1 },
    ],
  },
  {
    key: "manali-mall-road-hostel",
    destination: "manali",
    scene: "mountain",
    title: "Hostel dorms and private rooms near Mall Road",
    type: "hostel",
    locality: "Model Town",
    city: "Manali",
    region: "Himachal Pradesh",
    countryCode: "IN",
    currency: "INR",
    lat: 32.241,
    lng: 77.189,
    summary: "Mixed dorm beds and two private rooms, a few minutes from the Manali bus stand.",
    description:
      "Dorms have six beds with lockers and reading lights. The private rooms have their own bathroom. There is a shared kitchen and a common room with a heater.",
    bedrooms: 1,
    beds: 6,
    bathrooms: 1,
    amenities: ["wifi", "hot_water", "heating", "workspace", "restaurant"],
    policy: "flexible",
    tax: 500,
    rules: RULES_HOSTEL,
    units: [
      { name: "Bed in a 6 bed mixed dorm", price: 650, maxGuests: 1, beds: "1 bunk bed", quantity: 12, includedGuests: 1 },
      { name: "Private double room", price: 1800, maxGuests: 2, beds: "1 double bed", quantity: 2 },
    ],
  },

  // Jaipur
  {
    key: "jaipur-walled-city-haveli",
    destination: "jaipur",
    scene: "heritage",
    title: "Haveli rooms inside the walled city",
    type: "guesthouse",
    locality: "Pink City",
    city: "Jaipur",
    region: "Rajasthan",
    countryCode: "IN",
    currency: "INR",
    lat: 26.923,
    lng: 75.823,
    summary: "Six rooms around a courtyard in an old haveli, a short walk from the City Palace.",
    description:
      "The rooms open onto a central courtyard. The suite on the top floor has a sitting area and a window over the street. Breakfast and dinner are served in the courtyard.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "breakfast", "restaurant", "hot_water", "staff_24h"],
    policy: "moderate",
    tax: 500,
    rules: RULES_ID,
    units: [
      { name: "Courtyard room", price: 3800, maxGuests: 2, beds: "1 double bed", quantity: 5 },
      { name: "Top floor suite", price: 6200, maxGuests: 3, beds: "1 king bed, 1 single bed", quantity: 1, extraGuest: 800 },
    ],
  },
  {
    key: "jaipur-station-hotel",
    destination: "jaipur",
    scene: "heritage",
    title: "Hotel near Jaipur railway station",
    type: "hotel",
    locality: "Station Road",
    city: "Jaipur",
    region: "Rajasthan",
    countryCode: "IN",
    currency: "INR",
    lat: 26.92,
    lng: 75.789,
    summary: "A 16 room hotel about 600 metres from Jaipur Junction, with a restaurant and lift.",
    description:
      "Standard rooms have a double bed and a window onto the side street; deluxe rooms are larger and face the front. The front desk is open all night, which helps with early and late trains.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "tv", "lift", "restaurant", "staff_24h", "parking", "power_backup", "smoke_alarm"],
    policy: "flexible",
    tax: 500,
    rules: RULES_ID,
    units: [
      { name: "Standard double", price: 2900, maxGuests: 2, beds: "1 double bed", quantity: 10 },
      { name: "Deluxe double", price: 3600, maxGuests: 3, beds: "1 king bed", quantity: 6, extraGuest: 500 },
    ],
  },
  {
    key: "jaipur-amer-farmhouse",
    destination: "jaipur",
    scene: "heritage",
    title: "Farmhouse with a pool on the Amer road",
    type: "villa",
    locality: "Amer",
    city: "Jaipur",
    region: "Rajasthan",
    countryCode: "IN",
    currency: "INR",
    lat: 26.969,
    lng: 75.851,
    summary: "A four bedroom farmhouse with a private pool and lawn, 3 km from Amber Fort.",
    description:
      "Four bedrooms on two floors, a lawn, a pool and a covered terrace. A caretaker lives on site and a cook can be arranged with notice.",
    bedrooms: 4,
    beds: 4,
    bathrooms: 4,
    amenities: ["pool", "garden", "parking", "kitchen", "ac", "wifi", "power_backup"],
    policy: "strict",
    tax: 1800,
    cleaning: 2000,
    instantBook: false,
    minNights: 2,
    rules: RULES_HOME,
    units: [{ name: "Entire farmhouse", price: 18000, maxGuests: 8, beds: "4 double beds", includedGuests: 6, extraGuest: 1200 }],
  },

  // Udaipur
  {
    key: "udaipur-gangaur-ghat-rooms",
    destination: "udaipur",
    scene: "lake",
    title: "Lake-view rooms at Gangaur Ghat",
    type: "guesthouse",
    locality: "Gangaur Ghat",
    city: "Udaipur",
    region: "Rajasthan",
    countryCode: "IN",
    currency: "INR",
    lat: 24.579,
    lng: 73.683,
    summary: "Seven rooms by Lake Pichola, four of them with windows over the water.",
    description:
      "The building is on the lane behind Gangaur Ghat. Lake-view rooms are on the upper floors and the standard rooms face the lane. Breakfast is served on the roof.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "hot_water", "breakfast"],
    policy: "moderate",
    tax: 500,
    rules: RULES_ID,
    units: [
      { name: "Lake-view double", price: 4200, maxGuests: 2, beds: "1 double bed", quantity: 4 },
      { name: "Standard double", price: 2800, maxGuests: 2, beds: "1 double bed", quantity: 3 },
    ],
  },
  {
    key: "udaipur-fateh-sagar-apartment",
    destination: "udaipur",
    scene: "lake",
    title: "Apartment near Fateh Sagar",
    type: "apartment",
    locality: "Fateh Sagar",
    city: "Udaipur",
    region: "Rajasthan",
    countryCode: "IN",
    currency: "INR",
    lat: 24.601,
    lng: 73.681,
    summary: "A one bedroom apartment with a kitchen and desk, a few minutes from Fateh Sagar lake.",
    description:
      "The apartment is on the first floor of a residential building with a lift. It has a bedroom, a living room with a single bed, a kitchen and a washing machine.",
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    amenities: ["kitchen", "wifi", "ac", "washer", "workspace", "lift"],
    policy: "flexible",
    tax: 0,
    cleaning: 400,
    rules: RULES_HOME,
    units: [{ name: "Entire apartment", price: 3500, maxGuests: 3, beds: "1 double bed, 1 single bed", extraGuest: 400 }],
  },

  // Rishikesh
  {
    key: "rishikesh-tapovan-rooms",
    destination: "rishikesh",
    scene: "river",
    title: "Riverside rooms in Tapovan",
    type: "guesthouse",
    locality: "Tapovan",
    city: "Rishikesh",
    region: "Uttarakhand",
    countryCode: "IN",
    currency: "INR",
    lat: 30.129,
    lng: 78.32,
    summary: "Six double rooms above a vegetarian cafe in Tapovan, near the yoga schools.",
    description:
      "Each room has a double bed, a desk and a bathroom with hot water. The cafe downstairs serves vegetarian food from 07:00. The river is a five minute walk down the hill.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["wifi", "hot_water", "restaurant", "mountain_view", "workspace"],
    policy: "flexible",
    tax: 500,
    rules: RULES_ID,
    units: [{ name: "Double room", price: 2600, maxGuests: 2, beds: "1 double bed", quantity: 6 }],
  },
  {
    key: "rishikesh-laxman-jhula-hostel",
    destination: "rishikesh",
    scene: "river",
    title: "Hostel near Laxman Jhula",
    type: "hostel",
    locality: "Laxman Jhula",
    city: "Rishikesh",
    region: "Uttarakhand",
    countryCode: "IN",
    currency: "INR",
    lat: 30.125,
    lng: 78.327,
    summary: "Dorm beds and private rooms on the east bank, a short walk from the bridge.",
    description:
      "Dorms have eight beds with curtains and lockers. The private rooms sleep two. There is a rooftop with seating and a shared kitchen.",
    bedrooms: 1,
    beds: 8,
    bathrooms: 2,
    amenities: ["wifi", "hot_water", "restaurant", "workspace"],
    policy: "flexible",
    tax: 500,
    rules: RULES_HOSTEL,
    units: [
      { name: "Bed in an 8 bed dorm", price: 550, maxGuests: 1, beds: "1 bunk bed", quantity: 16, includedGuests: 1 },
      { name: "Private room", price: 1600, maxGuests: 2, beds: "1 double bed", quantity: 3 },
    ],
  },

  // Munnar
  {
    key: "munnar-estate-bungalow",
    destination: "munnar",
    scene: "tea",
    title: "Tea estate bungalow near Chithirapuram",
    type: "house",
    locality: "Chithirapuram",
    city: "Munnar",
    region: "Kerala",
    countryCode: "IN",
    currency: "INR",
    lat: 10.03,
    lng: 77.06,
    summary: "A three bedroom bungalow on a working tea estate, with a fireplace and garden.",
    description:
      "The bungalow has three bedrooms, a sitting room with a fireplace and a dining room. A cook prepares breakfast and can make other meals on request. The nearest town is a 20 minute drive.",
    bedrooms: 3,
    beds: 3,
    bathrooms: 3,
    amenities: ["mountain_view", "garden", "heating", "hot_water", "parking", "breakfast"],
    policy: "moderate",
    tax: 1800,
    cleaning: 1000,
    rules: RULES_HOME,
    units: [{ name: "Entire bungalow", price: 9500, maxGuests: 6, beds: "3 double beds", includedGuests: 4, extraGuest: 800 }],
  },
  {
    key: "munnar-pallivasal-homestay",
    destination: "munnar",
    scene: "tea",
    title: "Valley-view homestay in Pallivasal",
    type: "homestay",
    locality: "Pallivasal",
    city: "Munnar",
    region: "Kerala",
    countryCode: "IN",
    currency: "INR",
    lat: 10.065,
    lng: 77.05,
    summary: "Four rooms in a family home on the Munnar to Kochi road, with Kerala breakfast.",
    description:
      "The rooms face the valley and share a long balcony. The hosts serve a Kerala breakfast and can arrange a jeep to the tea museum and Eravikulam.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["hot_water", "breakfast", "mountain_view", "parking", "wifi", "balcony"],
    policy: "flexible",
    tax: 0,
    rules: RULES_ID,
    units: [{ name: "Double room", price: 2700, maxGuests: 2, beds: "1 double bed", quantity: 4 }],
  },

  // Alleppey
  {
    key: "alleppey-houseboat",
    destination: "alleppey",
    scene: "backwater",
    title: "Two-bedroom houseboat on Vembanad Lake",
    type: "other",
    locality: "Punnamada",
    city: "Alappuzha",
    region: "Kerala",
    countryCode: "IN",
    currency: "INR",
    lat: 9.515,
    lng: 76.35,
    summary: "An overnight houseboat with two air conditioned bedrooms, a crew of three and all meals.",
    description:
      "Boarding is at 12:00 at the Punnamada jetty and the boat cruises the backwaters until evening, then moors for the night. Lunch, dinner and breakfast are cooked on board. The air conditioning runs from 21:00 to 06:00.",
    bedrooms: 2,
    beds: 2,
    bathrooms: 2,
    amenities: ["ac", "breakfast", "restaurant", "hot_water"],
    policy: "strict",
    tax: 1800,
    checkIn: "12:00",
    checkOut: "09:00",
    rules: "Every adult guest shows a government photo ID at boarding.\nNo smoking inside the cabins.\nLife jackets are on board; children wear them on deck.",
    units: [{ name: "Whole houseboat", price: 12000, maxGuests: 4, beds: "2 double beds", includedGuests: 4 }],
  },
  {
    key: "alleppey-kainakary-homestay",
    destination: "alleppey",
    scene: "backwater",
    title: "Canal-side homestay in Kainakary",
    type: "homestay",
    locality: "Kainakary",
    city: "Alappuzha",
    region: "Kerala",
    countryCode: "IN",
    currency: "INR",
    lat: 9.48,
    lng: 76.37,
    summary: "Three rooms in a family home on a backwater canal, reached by a short boat ride.",
    description:
      "The hosts pick guests up by boat from the Alappuzha jetty. Rooms are simple, with fans and mosquito nets. Meals are home cooked and the garden runs down to the canal.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["breakfast", "wifi", "hot_water", "garden"],
    policy: "flexible",
    tax: 0,
    rules: RULES_ID,
    units: [{ name: "Double room", price: 2500, maxGuests: 2, beds: "1 double bed", quantity: 3 }],
  },

  // Coorg
  {
    key: "coorg-coffee-estate-cottages",
    destination: "coorg",
    scene: "tea",
    title: "Cottages on a coffee estate near Madikeri",
    type: "cabin",
    locality: "Galibeedu",
    city: "Madikeri",
    region: "Karnataka",
    countryCode: "IN",
    currency: "INR",
    lat: 12.4,
    lng: 75.76,
    summary: "Three stone cottages on a coffee and pepper estate, 8 km from Madikeri town.",
    description:
      "Each cottage has a double bed, a day bed and a verandah facing the estate. Breakfast is served in the main house. The estate manager runs a walk through the plantation most mornings.",
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    amenities: ["breakfast", "garden", "parking", "hot_water", "mountain_view"],
    policy: "moderate",
    tax: 500,
    rules: RULES_ID,
    units: [{ name: "Estate cottage", price: 5200, maxGuests: 3, beds: "1 double bed, 1 day bed", quantity: 3, extraGuest: 600 }],
  },
  {
    key: "coorg-virajpet-homestay",
    destination: "coorg",
    scene: "tea",
    title: "Plantation homestay in Virajpet",
    type: "homestay",
    locality: "Virajpet",
    city: "Virajpet",
    region: "Karnataka",
    countryCode: "IN",
    currency: "INR",
    lat: 12.196,
    lng: 75.805,
    summary: "Four rooms in a Kodava family home on a coffee plantation.",
    description:
      "The house is on the family's coffee plantation outside Virajpet. Meals are Kodava home cooking and are eaten with the family. The rooms are on the first floor.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["breakfast", "parking", "hot_water", "garden", "wifi"],
    policy: "flexible",
    tax: 0,
    rules: RULES_ID,
    units: [{ name: "Double room", price: 3000, maxGuests: 2, beds: "1 double bed", quantity: 4 }],
  },

  // Varanasi
  {
    key: "varanasi-assi-ghat-guesthouse",
    destination: "varanasi",
    scene: "river",
    title: "Guesthouse on Assi Ghat",
    type: "guesthouse",
    locality: "Assi Ghat",
    city: "Varanasi",
    region: "Uttar Pradesh",
    countryCode: "IN",
    currency: "INR",
    lat: 25.288,
    lng: 83.006,
    summary: "Eight rooms facing the Ganges at Assi Ghat, three of them with river views.",
    description:
      "The guesthouse is on the riverfront at the southern end of the ghats. River-view rooms are on the upper floors. Boats for the morning ride along the ghats leave from the steps in front.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "hot_water", "restaurant"],
    policy: "moderate",
    tax: 500,
    rules: RULES_ID,
    units: [
      { name: "River-view double", price: 3400, maxGuests: 2, beds: "1 double bed", quantity: 3 },
      { name: "Standard double", price: 2100, maxGuests: 2, beds: "1 double bed", quantity: 5 },
    ],
  },
  {
    key: "varanasi-dashashwamedh-rooftop",
    destination: "varanasi",
    scene: "river",
    title: "Rooftop rooms near Dashashwamedh Ghat",
    type: "homestay",
    locality: "Dashashwamedh",
    city: "Varanasi",
    region: "Uttar Pradesh",
    countryCode: "IN",
    currency: "INR",
    lat: 25.307,
    lng: 83.01,
    summary: "Four rooms on the top floor of a family house in the lanes behind the main ghat.",
    description:
      "The lanes here are too narrow for cars, so the hosts meet guests at Godowlia crossing. The evening aarti at Dashashwamedh Ghat is a three minute walk.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["wifi", "hot_water", "ac"],
    policy: "flexible",
    tax: 0,
    rules: RULES_ID,
    units: [{ name: "Double room", price: 1900, maxGuests: 2, beds: "1 double bed", quantity: 4 }],
  },

  // Pondicherry
  {
    key: "pondicherry-french-quarter-rooms",
    destination: "pondicherry",
    scene: "heritage",
    title: "Rooms in a French Quarter house",
    type: "guesthouse",
    locality: "White Town",
    city: "Puducherry",
    region: "Puducherry",
    countryCode: "IN",
    currency: "INR",
    lat: 11.934,
    lng: 79.835,
    summary: "Five rooms in a restored colonial house two streets from the seafront promenade.",
    description:
      "The rooms are around a courtyard garden with high ceilings and shuttered windows. Breakfast is served in the courtyard. The promenade is a three minute walk.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "breakfast", "garden", "hot_water"],
    policy: "moderate",
    tax: 500,
    rules: RULES_ID,
    units: [{ name: "Courtyard double", price: 4600, maxGuests: 2, beds: "1 queen bed", quantity: 5 }],
  },
  {
    key: "pondicherry-auroville-studio",
    destination: "pondicherry",
    scene: "beach",
    title: "Studio near Auroville",
    type: "apartment",
    locality: "Kottakuppam",
    city: "Kottakuppam",
    region: "Tamil Nadu",
    countryCode: "IN",
    currency: "INR",
    lat: 12.005,
    lng: 79.81,
    summary: "A studio with a kitchenette and desk on the road between Puducherry and Auroville.",
    description:
      "The studio has a double bed, a kitchenette, a desk and a bathroom. It is on the first floor above the owner's house. A scooter is the easiest way to get around.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["kitchen", "wifi", "ac", "workspace", "parking"],
    policy: "flexible",
    tax: 0,
    cleaning: 300,
    rules: RULES_HOME,
    units: [{ name: "Studio", price: 2800, maxGuests: 2, beds: "1 double bed" }],
  },

  // Mumbai
  {
    key: "mumbai-colaba-hotel",
    destination: "mumbai",
    scene: "city",
    title: "Hotel rooms in Colaba",
    type: "hotel",
    locality: "Colaba",
    city: "Mumbai",
    region: "Maharashtra",
    countryCode: "IN",
    currency: "INR",
    lat: 18.915,
    lng: 72.826,
    summary: "A 16 room hotel in Colaba, a 10 minute walk from the Gateway of India.",
    description:
      "Standard rooms face the inner lane. Bay-view rooms are on the top two floors and look over the harbour. The restaurant serves breakfast and dinner.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "tv", "lift", "restaurant", "staff_24h", "smoke_alarm"],
    policy: "moderate",
    tax: 1800,
    rules: RULES_ID,
    units: [
      { name: "Standard double", price: 6500, maxGuests: 2, beds: "1 double bed", quantity: 12 },
      { name: "Bay-view double", price: 9800, maxGuests: 2, beds: "1 king bed", quantity: 4 },
    ],
  },
  {
    key: "mumbai-bandra-flat",
    destination: "mumbai",
    scene: "city",
    title: "One-bedroom flat in Bandra West",
    type: "apartment",
    locality: "Bandra West",
    city: "Mumbai",
    region: "Maharashtra",
    countryCode: "IN",
    currency: "INR",
    lat: 19.06,
    lng: 72.834,
    summary: "A one bedroom flat with a desk and washing machine, near Bandra station.",
    description:
      "The flat is on the fourth floor of a building with a lift. It has a bedroom, a living room with a sofa bed and a kitchen. Bandra station is a 10 minute walk.",
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    amenities: ["ac", "wifi", "kitchen", "washer", "workspace", "lift", "tv"],
    policy: "moderate",
    tax: 500,
    cleaning: 800,
    minNights: 2,
    rules: RULES_HOME,
    units: [{ name: "Entire flat", price: 7200, maxGuests: 3, beds: "1 queen bed, 1 sofa bed", extraGuest: 700 }],
  },

  // Delhi
  {
    key: "delhi-hauz-khas-guesthouse",
    destination: "delhi",
    scene: "city",
    title: "Guesthouse in Hauz Khas",
    type: "guesthouse",
    locality: "Hauz Khas",
    city: "New Delhi",
    region: "Delhi",
    countryCode: "IN",
    currency: "INR",
    lat: 28.55,
    lng: 77.2,
    summary: "Eight rooms in a residential street near Hauz Khas metro station.",
    description:
      "Double rooms are on the first and second floors and the family rooms are on the third. Breakfast is included. Green Park and Hauz Khas metro stations are both within a 10 minute walk.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "breakfast", "power_backup", "hot_water"],
    policy: "moderate",
    tax: 500,
    rules: RULES_ID,
    units: [
      { name: "Double room", price: 3900, maxGuests: 2, beds: "1 double bed", quantity: 6 },
      { name: "Family room", price: 5400, maxGuests: 4, beds: "1 double bed, 2 single beds", quantity: 2, extraGuest: 600 },
    ],
  },
  {
    key: "delhi-aerocity-hotel",
    destination: "delhi",
    scene: "city",
    title: "Business hotel near Aerocity",
    type: "hotel",
    locality: "Mahipalpur",
    city: "New Delhi",
    region: "Delhi",
    countryCode: "IN",
    currency: "INR",
    lat: 28.545,
    lng: 77.122,
    summary: "A 28 room hotel about 4 km from Terminal 3, with a gym and airport pickup on request.",
    description:
      "Rooms are sound insulated against aircraft noise. The front desk is open all night and can arrange airport pickup. Aerocity metro station is about 2 km away.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "tv", "gym", "lift", "restaurant", "staff_24h", "airport_pickup", "smoke_alarm", "step_free"],
    policy: "flexible",
    tax: 1800,
    rules: RULES_ID,
    units: [
      { name: "Standard room", price: 6900, maxGuests: 2, beds: "1 queen bed", quantity: 20 },
      { name: "Executive room", price: 8900, maxGuests: 3, beds: "1 king bed", quantity: 8, extraGuest: 1000 },
    ],
  },

  // Single listings elsewhere in India
  {
    key: "leh-changspa-guesthouse",
    destination: "leh",
    scene: "mountain",
    title: "Family guesthouse in Changspa",
    type: "guesthouse",
    locality: "Changspa",
    city: "Leh",
    region: "Ladakh",
    countryCode: "IN",
    currency: "INR",
    lat: 34.165,
    lng: 77.57,
    summary: "Six rooms in a Ladakhi family house with a vegetable garden, 15 minutes on foot from the market.",
    description:
      "The rooms are on the first floor around a sunny corridor. Breakfast and dinner are cooked by the family. The hosts recommend two quiet days on arrival before any trips to higher passes.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["hot_water", "heating", "breakfast", "mountain_view", "wifi", "parking", "garden"],
    policy: "flexible",
    tax: 0,
    minNights: 2,
    rules: RULES_ID,
    units: [{ name: "Double room", price: 2600, maxGuests: 2, beds: "1 double bed", quantity: 6 }],
  },
  {
    key: "darjeeling-kangchenjunga-rooms",
    destination: "darjeeling",
    scene: "tea",
    title: "Rooms facing Kangchenjunga",
    type: "homestay",
    locality: "Chowrasta",
    city: "Darjeeling",
    region: "West Bengal",
    countryCode: "IN",
    currency: "INR",
    lat: 27.045,
    lng: 88.27,
    summary: "Three rooms in a family home below Chowrasta, with windows facing north to the mountains.",
    description:
      "Each room has a heater and a window seat. Breakfast is served in the family kitchen. The Mall and Chowrasta square are a five minute walk uphill.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["heating", "hot_water", "breakfast", "mountain_view", "wifi"],
    policy: "moderate",
    tax: 0,
    rules: RULES_ID,
    units: [{ name: "Double room", price: 3100, maxGuests: 2, beds: "1 double bed", quantity: 3 }],
  },
  {
    key: "kochi-fort-kochi-house",
    destination: "kochi",
    scene: "backwater",
    title: "Dutch-era house in Fort Kochi",
    type: "guesthouse",
    locality: "Fort Kochi",
    city: "Kochi",
    region: "Kerala",
    countryCode: "IN",
    currency: "INR",
    lat: 9.965,
    lng: 76.242,
    summary: "Five rooms in an old house with a garden, a short walk from the Chinese fishing nets.",
    description:
      "The house has wooden floors upstairs and a garden at the back where breakfast is served. Fort Kochi beach and the ferry jetty are within walking distance.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "breakfast", "garden", "hot_water"],
    policy: "moderate",
    tax: 500,
    rules: RULES_ID,
    units: [{ name: "Double room", price: 3700, maxGuests: 2, beds: "1 double bed", quantity: 5 }],
  },
  {
    key: "hampi-kamalapur-cottages",
    destination: "hampi",
    scene: "boulders",
    title: "Cottages in Kamalapur",
    type: "cabin",
    locality: "Kamalapur",
    city: "Kamalapur",
    region: "Karnataka",
    countryCode: "IN",
    currency: "INR",
    lat: 15.317,
    lng: 76.475,
    summary: "Eight simple cottages around a garden at the south edge of the Hampi ruins.",
    description:
      "Cottages have a double bed, a fan and a bathroom with hot water in the mornings. The restaurant serves South Indian meals. Bicycles can be hired at the gate.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["restaurant", "hot_water", "garden", "parking"],
    policy: "flexible",
    tax: 0,
    rules: RULES_ID,
    units: [{ name: "Garden cottage", price: 2300, maxGuests: 2, beds: "1 double bed", quantity: 8 }],
  },
  {
    key: "jaisalmer-fort-rooms",
    destination: "jaisalmer",
    scene: "desert",
    title: "Rooms inside Jaisalmer Fort",
    type: "guesthouse",
    locality: "Jaisalmer Fort",
    city: "Jaisalmer",
    region: "Rajasthan",
    countryCode: "IN",
    currency: "INR",
    lat: 26.9124,
    lng: 70.9128,
    summary: "Five rooms in a sandstone house inside the fort walls, with a rooftop restaurant.",
    description:
      "Cars cannot enter the fort, so the hosts send someone to meet guests at the main gate. The rooms have thick stone walls and stay cool in the day. The rooftop looks west over the town.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "hot_water", "restaurant"],
    policy: "moderate",
    tax: 500,
    rules: RULES_ID,
    units: [{ name: "Double room", price: 2900, maxGuests: 2, beds: "1 double bed", quantity: 5 }],
  },
  {
    key: "shimla-ridge-hotel",
    destination: "shimla",
    scene: "mountain",
    title: "Hotel rooms below the Ridge",
    type: "hotel",
    locality: "The Mall",
    city: "Shimla",
    region: "Himachal Pradesh",
    countryCode: "IN",
    currency: "INR",
    lat: 31.104,
    lng: 77.172,
    summary: "An eight room hotel just below the Ridge, with a lift down to the Cart Road.",
    description:
      "Rooms have heaters and windows facing the valley. The Mall Road is closed to most traffic, so luggage is carried up from the Cart Road by porters the hotel arranges.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["heating", "hot_water", "wifi", "tv", "restaurant", "lift", "mountain_view"],
    policy: "moderate",
    tax: 500,
    rules: RULES_ID,
    units: [{ name: "Valley-view double", price: 3800, maxGuests: 2, beds: "1 double bed", quantity: 8 }],
  },
  {
    key: "agra-taj-east-gate-guesthouse",
    destination: "agra",
    scene: "heritage",
    title: "Guesthouse near the Taj Mahal east gate",
    type: "guesthouse",
    locality: "Taj Ganj",
    city: "Agra",
    region: "Uttar Pradesh",
    countryCode: "IN",
    currency: "INR",
    lat: 27.17,
    lng: 78.049,
    summary: "Six rooms about 500 metres from the east gate, with a rooftop that faces the Taj Mahal.",
    description:
      "The ticket office at the east gate is a short walk away, which helps for sunrise visits. Rooms are simple and clean, with air conditioning. Breakfast is served on the roof.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "hot_water", "restaurant"],
    policy: "flexible",
    tax: 500,
    rules: RULES_ID,
    units: [{ name: "Double room", price: 2800, maxGuests: 2, beds: "1 double bed", quantity: 6 }],
  },

  // International
  {
    key: "dubai-marina-studio",
    destination: "dubai",
    scene: "city",
    title: "Studio in Dubai Marina",
    type: "apartment",
    locality: "Dubai Marina",
    city: "Dubai",
    region: "Dubai",
    countryCode: "AE",
    currency: "AED",
    lat: 25.08,
    lng: 55.14,
    summary: "A studio on the 18th floor of a Marina tower, with access to the building pool and gym.",
    description:
      "The studio has a queen bed, a kitchenette, a washing machine and a balcony. The building has a pool and gym on the podium level. Dubai Marina tram and metro stations are a short walk.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "kitchen", "pool", "gym", "lift", "washer", "balcony"],
    policy: "moderate",
    tax: 500,
    cleaning: 100,
    minNights: 2,
    rules: RULES_HOME,
    units: [{ name: "Studio", price: 450, maxGuests: 2, beds: "1 queen bed" }],
  },
  {
    key: "bangkok-phrom-phong-hotel",
    destination: "bangkok",
    scene: "city",
    title: "Hotel rooms near Phrom Phong BTS",
    type: "hotel",
    locality: "Khlong Toei Nuea",
    city: "Bangkok",
    region: "Bangkok",
    countryCode: "TH",
    currency: "THB",
    lat: 13.73,
    lng: 100.57,
    summary: "A 10 room hotel in a soi off Sukhumvit Road, five minutes from Phrom Phong station.",
    description:
      "Rooms have a queen bed, a desk and a rain shower. There is a small pool and gym on the roof. The front desk is staffed around the clock.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "tv", "pool", "gym", "lift", "staff_24h", "workspace"],
    policy: "flexible",
    tax: 700,
    rules: RULES_ID,
    units: [{ name: "Queen room", price: 2400, maxGuests: 2, beds: "1 queen bed", quantity: 10 }],
  },
  {
    key: "bali-ubud-pool-villa",
    destination: "bali",
    scene: "tropical",
    title: "Villa with a pool near Ubud",
    type: "villa",
    locality: "Penestanan",
    city: "Ubud",
    region: "Bali",
    countryCode: "ID",
    currency: "IDR",
    lat: -8.5069,
    lng: 115.2525,
    summary: "A two bedroom villa with a private pool, a 15 minute walk from central Ubud.",
    description:
      "Two bedrooms with their own bathrooms face a private pool and garden. Breakfast is cooked in the villa kitchen each morning. The path to Ubud crosses rice fields.",
    bedrooms: 2,
    beds: 2,
    bathrooms: 2,
    amenities: ["pool", "garden", "ac", "wifi", "kitchen", "breakfast"],
    policy: "strict",
    tax: 1000,
    instantBook: false,
    rules: RULES_HOME,
    units: [{ name: "Entire villa", price: 1850000, maxGuests: 4, beds: "2 king beds", includedGuests: 4 }],
  },
  {
    key: "london-islington-room",
    destination: "london",
    scene: "city",
    title: "Double room in a Victorian house, Islington",
    type: "homestay",
    locality: "Islington",
    city: "London",
    region: "England",
    countryCode: "GB",
    currency: "GBP",
    lat: 51.538,
    lng: -0.103,
    summary: "Two double rooms on the top floor of the host's house, near Angel station.",
    description:
      "The rooms share a bathroom on the same floor. Guests can use the kitchen for breakfast and the washing machine. Angel Underground station is an eight minute walk.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["wifi", "heating", "hot_water", "workspace", "washer"],
    policy: "moderate",
    tax: 0,
    rules: RULES_HOME,
    units: [{ name: "Double room", price: 95, maxGuests: 2, beds: "1 double bed", quantity: 2 }],
  },
  {
    key: "tokyo-asakusa-hotel",
    destination: "tokyo",
    scene: "city",
    title: "Small hotel rooms in Asakusa",
    type: "hotel",
    locality: "Asakusa",
    city: "Tokyo",
    region: "Tokyo",
    countryCode: "JP",
    currency: "JPY",
    lat: 35.7148,
    lng: 139.7967,
    summary: "Twelve compact rooms near Senso-ji, a few minutes from Asakusa station.",
    description:
      "Double rooms have a semi-double bed and twin rooms have two single beds. Every room has a small bathroom. The Asakusa line runs direct to Haneda and Narita airports.",
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: ["ac", "wifi", "lift", "staff_24h"],
    policy: "flexible",
    tax: 1000,
    checkIn: "15:00",
    checkOut: "10:00",
    rules: "No smoking anywhere in the building.\nQuiet hours from 22:00 to 07:00.",
    units: [
      { name: "Double room", price: 14000, maxGuests: 2, beds: "1 semi-double bed", quantity: 8 },
      { name: "Twin room", price: 16500, maxGuests: 2, beds: "2 single beds", quantity: 4 },
    ],
  },
];

const typeLabel: Record<PropertyType, string> = {
  hotel: "hotel",
  guesthouse: "guesthouse",
  homestay: "home",
  apartment: "apartment building",
  house: "house",
  villa: "villa",
  hostel: "hostel",
  resort: "resort",
  cabin: "cottage",
  other: "boat",
};

/** Photo files for a listing, in display order. Generated illustrations, not photographs. */
export function demoPhotos(l: DemoListing) {
  return [
    { file: `${l.key}-1.webp`, alt: `Illustration of the ${typeLabel[l.type]} from outside` },
    { file: `${l.key}-2.webp`, alt: `Illustration of a bedroom: ${l.units[0].name.toLowerCase()}` },
    { file: `${l.key}-3.webp`, alt: "Illustration of the shared space inside" },
    { file: `scene-${l.destination}.webp`, alt: `Illustration of the landscape around ${l.city}` },
  ];
}

export const DEMO_PHOTO_SIZE = { width: 1200, height: 800 };

/**
 * Creates the demo host and demo listings. Rows use stable ids, so running it again updates them in place
 * and keeps any test bookings made against them.
 */
export async function seedDemoListings(db: SeedDb) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo listings with NODE_ENV=production.");
  }

  await db
    .insert(user)
    .values({ id: DEMO_HOST_ID, name: "Sample host", email: "sample-host@example.com", emailVerified: false, role: "host" })
    .onConflictDoNothing();
  await db
    .insert(hostProfiles)
    .values({ userId: DEMO_HOST_ID, displayName: "Sample host", about: "This account owns the sample listings used for testing.", languages: ["English"] })
    .onConflictDoNothing();

  const keys = demoListings.map((l) => l.key);

  for (const l of demoListings) {
    const id = `lst_demo_${l.key.replace(/-/g, "_")}`;
    const fromPrice = Math.min(...l.units.map((u) => toMinor(u.price, l.currency)));
    const row = {
      id,
      hostId: DEMO_HOST_ID,
      kind: "stay" as const,
      status: "published" as const,
      slug: l.key,
      title: l.title,
      summary: l.summary,
      description: l.description,
      propertyType: l.type,
      locality: l.locality,
      city: l.city,
      region: l.region,
      countryCode: l.countryCode,
      lat: l.lat,
      lng: l.lng,
      destinationSlug: l.destination,
      maxGuests: Math.max(...l.units.map((u) => u.maxGuests)),
      bedrooms: l.bedrooms,
      beds: l.beds,
      bathrooms: l.bathrooms,
      amenities: l.amenities,
      houseRules: l.rules ?? RULES_HOME,
      checkInFrom: l.checkIn ?? "14:00",
      checkOutUntil: l.checkOut ?? "11:00",
      currency: l.currency,
      fromPrice,
      cleaningFee: toMinor(l.cleaning ?? 0, l.currency),
      taxBps: l.tax,
      minNights: l.minNights ?? 1,
      maxNights: 30,
      instantBook: l.instantBook ?? true,
      cancellationPolicy: l.policy,
      ratingAvg: 0,
      ratingCount: 0,
      verified: false,
      isDemo: true,
      publishedAt: new Date(),
      updatedAt: new Date(),
    };
    await db
      .insert(listings)
      .values(row)
      .onConflictDoUpdate({ target: listings.id, set: { ...row, id: undefined, publishedAt: undefined } });

    const unitIds = l.units.map((_, i) => `${id.replace("lst_", "unt_")}_${i + 1}`);
    for (const [i, u] of l.units.entries()) {
      const unit = {
        id: unitIds[i],
        listingId: id,
        name: u.name,
        description: u.description ?? "",
        maxGuests: u.maxGuests,
        beds: u.beds,
        basePrice: toMinor(u.price, l.currency),
        extraGuestPrice: toMinor(u.extraGuest ?? 0, l.currency),
        includedGuests: Math.min(u.includedGuests ?? 2, u.maxGuests),
        quantity: u.quantity ?? 1,
        amenities: [],
        active: true,
        position: i,
        updatedAt: new Date(),
      };
      await db
        .insert(listingUnits)
        .values(unit)
        .onConflictDoUpdate({ target: listingUnits.id, set: { ...unit, id: undefined } });
    }
    // Units removed from the seed data are switched off rather than deleted, in case bookings point at them.
    await db
      .update(listingUnits)
      .set({ active: false })
      .where(and(eq(listingUnits.listingId, id), notInArray(listingUnits.id, unitIds)));

    await db.delete(listingPhotos).where(eq(listingPhotos.listingId, id));
    await db.insert(listingPhotos).values(
      demoPhotos(l).map((p, i) => ({
        id: `${id.replace("lst_", "pho_")}_${i + 1}`,
        listingId: id,
        url: `/demo/${p.file}`,
        alt: p.alt,
        width: DEMO_PHOTO_SIZE.width,
        height: DEMO_PHOTO_SIZE.height,
        position: i,
      })),
    );
  }

  // Demo listings dropped from the seed data are archived.
  await db
    .update(listings)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(listings.hostId, DEMO_HOST_ID), eq(listings.isDemo, true), notInArray(listings.slug, keys)));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(eq(listings.isDemo, true), inArray(listings.slug, keys)));
  return count;
}
