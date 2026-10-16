import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { destinations } from "../../src/db/schema";
import type * as schema from "../../src/db/schema";

type SeedDb = PostgresJsDatabase<typeof schema>;

export type DestinationSeed = {
  slug: string;
  name: string;
  region: string | null;
  countryCode: string;
  countryName: string;
  lat: number;
  lng: number;
  radiusKm: number;
  nearestAirports: string[];
  summary: string;
  featured?: boolean;
};

/**
 * Places with a stay search and a destination page. Coordinates are the town centre (or the middle of
 * the area for islands and districts); the radius decides which listings a search for the place finds.
 * Summaries are plain facts. Keep them short and checkable.
 */
export const destinationSeeds: DestinationSeed[] = [
  // India
  {
    slug: "goa",
    name: "Goa",
    region: "Goa",
    countryCode: "IN",
    countryName: "India",
    lat: 15.4,
    lng: 73.95,
    radiusKm: 60,
    nearestAirports: ["GOX", "GOI"],
    summary:
      "Goa is India's smallest state by area, on the Konkan coast of the Arabian Sea. It was a Portuguese colony until 1961, and the churches of Old Goa and the Latin quarter of Panaji date from that time. Beaches run along most of the coast, from Arambol in the north to Palolem in the south.",
    featured: true,
  },
  {
    slug: "manali",
    name: "Manali",
    region: "Himachal Pradesh",
    countryCode: "IN",
    countryName: "India",
    lat: 32.2432,
    lng: 77.1892,
    radiusKm: 25,
    nearestAirports: ["KUU"],
    summary:
      "Manali is a hill town in the Kullu valley of Himachal Pradesh, at about 2,000 metres on the Beas river. The road north through the Atal Tunnel to Lahaul and Ladakh starts here. Snow usually closes the higher passes in winter.",
    featured: true,
  },
  {
    slug: "jaipur",
    name: "Jaipur",
    region: "Rajasthan",
    countryCode: "IN",
    countryName: "India",
    lat: 26.9124,
    lng: 75.7873,
    radiusKm: 25,
    nearestAirports: ["JAI"],
    summary:
      "Jaipur is the capital of Rajasthan. Its walled old city was founded in 1727 by Maharaja Sawai Jai Singh II and is a UNESCO World Heritage Site. Amber Fort, the City Palace and the Jantar Mantar observatory are the main sights.",
    featured: true,
  },
  {
    slug: "udaipur",
    name: "Udaipur",
    region: "Rajasthan",
    countryCode: "IN",
    countryName: "India",
    lat: 24.5854,
    lng: 73.7125,
    radiusKm: 20,
    nearestAirports: ["UDR"],
    summary:
      "Udaipur is a city in southern Rajasthan built around a chain of artificial lakes, including Lake Pichola and Fateh Sagar. It was the capital of the Mewar kingdom, and the City Palace stands on the east bank of Lake Pichola.",
    featured: true,
  },
  {
    slug: "rishikesh",
    name: "Rishikesh",
    region: "Uttarakhand",
    countryCode: "IN",
    countryName: "India",
    lat: 30.0869,
    lng: 78.2676,
    radiusKm: 20,
    nearestAirports: ["DED"],
    summary:
      "Rishikesh is on the Ganges in Uttarakhand, where the river leaves the Himalayan foothills. It is known for its ashrams and yoga schools, and for rafting on the river upstream of the town.",
  },
  {
    slug: "munnar",
    name: "Munnar",
    region: "Kerala",
    countryCode: "IN",
    countryName: "India",
    lat: 10.0889,
    lng: 77.0595,
    radiusKm: 25,
    nearestAirports: ["COK"],
    summary:
      "Munnar is a hill station in the Western Ghats of Kerala, at about 1,600 metres. Tea estates cover the slopes around the town. Eravikulam National Park, home to the Nilgiri tahr, is nearby.",
  },
  {
    slug: "alleppey",
    name: "Alleppey",
    region: "Kerala",
    countryCode: "IN",
    countryName: "India",
    lat: 9.4981,
    lng: 76.3388,
    radiusKm: 25,
    nearestAirports: ["COK", "TRV"],
    summary:
      "Alappuzha, also called Alleppey, is a town on the Kerala coast at the edge of the Kuttanad backwaters. Many visitors stay on houseboats on the canals and Vembanad Lake. The Nehru Trophy snake boat race is held here in August.",
  },
  {
    slug: "coorg",
    name: "Coorg",
    region: "Karnataka",
    countryCode: "IN",
    countryName: "India",
    lat: 12.4244,
    lng: 75.7382,
    radiusKm: 40,
    nearestAirports: ["CNN", "IXE"],
    summary:
      "Kodagu, also known as Coorg, is a hilly district of Karnataka in the Western Ghats. Much of the land is planted with coffee, and Madikeri is the main town.",
  },
  {
    slug: "ooty",
    name: "Ooty",
    region: "Tamil Nadu",
    countryCode: "IN",
    countryName: "India",
    lat: 11.4102,
    lng: 76.695,
    radiusKm: 20,
    nearestAirports: ["CJB"],
    summary:
      "Ooty, officially Udhagamandalam, is a hill station in the Nilgiri hills of Tamil Nadu at about 2,200 metres. The Nilgiri Mountain Railway, a UNESCO World Heritage Site, climbs to it from Mettupalayam.",
  },
  {
    slug: "darjeeling",
    name: "Darjeeling",
    region: "West Bengal",
    countryCode: "IN",
    countryName: "India",
    lat: 27.041,
    lng: 88.2663,
    radiusKm: 20,
    nearestAirports: ["IXB"],
    summary:
      "Darjeeling is a hill town in northern West Bengal at about 2,000 metres, known for its tea. The Darjeeling Himalayan Railway, a UNESCO World Heritage Site, runs up from the plains, and Kangchenjunga can be seen on clear days.",
  },
  {
    slug: "gangtok",
    name: "Gangtok",
    region: "Sikkim",
    countryCode: "IN",
    countryName: "India",
    lat: 27.3389,
    lng: 88.6065,
    radiusKm: 20,
    nearestAirports: ["PYG", "IXB"],
    summary:
      "Gangtok is the capital of Sikkim, on a ridge in the eastern Himalaya at about 1,650 metres. Some nearby areas, such as Tsomgo Lake and Nathu La, need a permit, which local tour operators arrange.",
  },
  {
    slug: "leh",
    name: "Leh",
    region: "Ladakh",
    countryCode: "IN",
    countryName: "India",
    lat: 34.1526,
    lng: 77.5771,
    radiusKm: 25,
    nearestAirports: ["IXL"],
    summary:
      "Leh is the main town of Ladakh, at about 3,500 metres. Visitors who fly in are advised to rest for a day or two to adjust to the altitude. Pangong Tso and the Nubra valley are reached by road from here.",
  },
  {
    slug: "varanasi",
    name: "Varanasi",
    region: "Uttar Pradesh",
    countryCode: "IN",
    countryName: "India",
    lat: 25.3176,
    lng: 82.9739,
    radiusKm: 20,
    nearestAirports: ["VNS"],
    summary:
      "Varanasi is on the west bank of the Ganges in Uttar Pradesh and is one of the oldest continuously inhabited cities in the world. Its riverfront is lined with ghats, the stone steps where people bathe, pray and cremate the dead. Sarnath, where the Buddha gave his first sermon, is about 10 km away.",
    featured: true,
  },
  {
    slug: "pondicherry",
    name: "Pondicherry",
    region: "Puducherry",
    countryCode: "IN",
    countryName: "India",
    lat: 11.9416,
    lng: 79.8083,
    radiusKm: 20,
    nearestAirports: ["PNY", "MAA"],
    summary:
      "Puducherry, often called Pondicherry, is on the Coromandel coast south of Chennai. It was the capital of French India until 1954, and the streets near the seafront still carry French names. Auroville is about 10 km to the north.",
  },
  {
    slug: "hampi",
    name: "Hampi",
    region: "Karnataka",
    countryCode: "IN",
    countryName: "India",
    lat: 15.335,
    lng: 76.46,
    radiusKm: 20,
    nearestAirports: ["VDY", "HBX"],
    summary:
      "Hampi was the capital of the Vijayanagara empire from the 14th to the 16th century. Its ruined temples, bazaars and royal buildings are spread over a landscape of granite boulders on the Tungabhadra river and form a UNESCO World Heritage Site.",
  },
  {
    slug: "mumbai",
    name: "Mumbai",
    region: "Maharashtra",
    countryCode: "IN",
    countryName: "India",
    lat: 19.076,
    lng: 72.8777,
    radiusKm: 30,
    nearestAirports: ["BOM", "NMI"],
    summary:
      "Mumbai is the capital of Maharashtra and India's main financial centre. The Gateway of India and the Chhatrapati Shivaji Maharaj Terminus railway station are in the south of the city, among Victorian Gothic and Art Deco buildings listed by UNESCO.",
  },
  {
    slug: "delhi",
    name: "Delhi",
    region: "Delhi",
    countryCode: "IN",
    countryName: "India",
    lat: 28.6139,
    lng: 77.209,
    radiusKm: 30,
    nearestAirports: ["DEL"],
    summary:
      "Delhi is India's capital territory and includes New Delhi, the seat of government. The Red Fort, Qutub Minar and Humayun's Tomb are all UNESCO World Heritage Sites. The Delhi Metro links the airport with the centre.",
  },
  {
    slug: "bengaluru",
    name: "Bengaluru",
    region: "Karnataka",
    countryCode: "IN",
    countryName: "India",
    lat: 12.9716,
    lng: 77.5946,
    radiusKm: 30,
    nearestAirports: ["BLR"],
    summary:
      "Bengaluru is the capital of Karnataka and the centre of India's software industry. It sits on the Deccan plateau at about 900 metres, so it is milder than most Indian cities. The airport is about 35 km north of the centre.",
  },
  {
    slug: "kochi",
    name: "Kochi",
    region: "Kerala",
    countryCode: "IN",
    countryName: "India",
    lat: 9.9312,
    lng: 76.2673,
    radiusKm: 20,
    nearestAirports: ["COK"],
    summary:
      "Kochi is a port city on the Kerala coast. Fort Kochi, on the peninsula, has Chinese fishing nets and buildings from Portuguese, Dutch and British rule, and the Paradesi Synagogue in Mattancherry dates from 1568.",
  },
  {
    slug: "shimla",
    name: "Shimla",
    region: "Himachal Pradesh",
    countryCode: "IN",
    countryName: "India",
    lat: 31.1048,
    lng: 77.1734,
    radiusKm: 20,
    nearestAirports: ["SLV", "IXC"],
    summary:
      "Shimla is the capital of Himachal Pradesh and was the summer capital of British India. The Kalka to Shimla railway, a UNESCO World Heritage Site, ends here.",
  },
  {
    slug: "mussoorie",
    name: "Mussoorie",
    region: "Uttarakhand",
    countryCode: "IN",
    countryName: "India",
    lat: 30.4598,
    lng: 78.0644,
    radiusKm: 15,
    nearestAirports: ["DED"],
    summary:
      "Mussoorie is a hill station in Uttarakhand at about 2,000 metres, above Dehradun. The Mall Road runs along the ridge, with the Doon valley on one side and Himalayan peaks on the other.",
  },
  {
    slug: "andaman",
    name: "Andaman Islands",
    region: "Andaman and Nicobar Islands",
    countryCode: "IN",
    countryName: "India",
    lat: 11.6234,
    lng: 92.7265,
    radiusKm: 60,
    nearestAirports: ["IXZ"],
    summary:
      "The Andaman Islands are in the Bay of Bengal, about 1,200 km east of the Indian mainland. Flights land at Sri Vijaya Puram, the capital, which was called Port Blair until 2024. Ferries run from there to Swaraj Dweep (Havelock) and Shaheed Dweep (Neil).",
  },
  {
    slug: "agra",
    name: "Agra",
    region: "Uttar Pradesh",
    countryCode: "IN",
    countryName: "India",
    lat: 27.1767,
    lng: 78.0081,
    radiusKm: 20,
    nearestAirports: ["AGR", "DEL"],
    summary:
      "Agra is on the Yamuna river in Uttar Pradesh. The Taj Mahal and Agra Fort are in the city and Fatehpur Sikri is about 40 km west; all three are UNESCO World Heritage Sites. The Taj Mahal is closed on Fridays.",
  },
  {
    slug: "amritsar",
    name: "Amritsar",
    region: "Punjab",
    countryCode: "IN",
    countryName: "India",
    lat: 31.634,
    lng: 74.8723,
    radiusKm: 20,
    nearestAirports: ["ATQ"],
    summary:
      "Amritsar is a city in Punjab near the border with Pakistan. The Golden Temple, the holiest shrine of Sikhism, is in the old city. The border ceremony at Attari takes place every evening, about 30 km west.",
  },
  {
    slug: "jaisalmer",
    name: "Jaisalmer",
    region: "Rajasthan",
    countryCode: "IN",
    countryName: "India",
    lat: 26.9157,
    lng: 70.9083,
    radiusKm: 50,
    nearestAirports: ["JSA", "JDH"],
    summary:
      "Jaisalmer is in the Thar desert in western Rajasthan. Its yellow sandstone fort, begun in 1156, is still lived in. The Sam sand dunes are about 40 km west of the town.",
  },

  // International
  {
    slug: "dubai",
    name: "Dubai",
    region: "Dubai",
    countryCode: "AE",
    countryName: "United Arab Emirates",
    lat: 25.2048,
    lng: 55.2708,
    radiusKm: 35,
    nearestAirports: ["DXB", "DWC"],
    summary:
      "Dubai is the largest city in the United Arab Emirates, on the Persian Gulf. Burj Khalifa, the tallest building in the world, is in Downtown Dubai. The older districts of Deira and Al Fahidi are on Dubai Creek.",
    featured: true,
  },
  {
    slug: "bangkok",
    name: "Bangkok",
    region: "Bangkok",
    countryCode: "TH",
    countryName: "Thailand",
    lat: 13.7563,
    lng: 100.5018,
    radiusKm: 30,
    nearestAirports: ["BKK", "DMK"],
    summary:
      "Bangkok is the capital of Thailand, on the Chao Phraya river. The Grand Palace and Wat Pho are in the old royal quarter of Rattanakosin. The BTS Skytrain and MRT lines reach most other districts.",
    featured: true,
  },
  {
    slug: "phuket",
    name: "Phuket",
    region: "Phuket",
    countryCode: "TH",
    countryName: "Thailand",
    lat: 7.8804,
    lng: 98.3923,
    radiusKm: 30,
    nearestAirports: ["HKT"],
    summary:
      "Phuket is Thailand's largest island, in the Andaman Sea. Patong, Kata and Karon are its busiest beaches. The old quarter of Phuket Town has Sino-Portuguese shophouses.",
  },
  {
    slug: "bali",
    name: "Bali",
    region: "Bali",
    countryCode: "ID",
    countryName: "Indonesia",
    lat: -8.4095,
    lng: 115.1889,
    radiusKm: 70,
    nearestAirports: ["DPS"],
    summary:
      "Bali is an Indonesian island east of Java. Most of its people are Hindu, unlike most of Indonesia. Ubud, inland, is known for rice terraces and crafts, and the south has the beach areas of Seminyak, Kuta and Uluwatu.",
    featured: true,
  },
  {
    slug: "singapore",
    name: "Singapore",
    region: null,
    countryCode: "SG",
    countryName: "Singapore",
    lat: 1.3521,
    lng: 103.8198,
    radiusKm: 30,
    nearestAirports: ["SIN"],
    summary:
      "Singapore is an island city state at the southern tip of the Malay Peninsula. The MRT reaches most of the island, including Changi Airport. Marina Bay, Chinatown and Little India are close to the centre.",
    featured: true,
  },
  {
    slug: "kuala-lumpur",
    name: "Kuala Lumpur",
    region: null,
    countryCode: "MY",
    countryName: "Malaysia",
    lat: 3.139,
    lng: 101.6869,
    radiusKm: 30,
    nearestAirports: ["KUL"],
    summary:
      "Kuala Lumpur is the capital of Malaysia. The Petronas Twin Towers are in the city centre, and the Batu Caves temple is about 13 km north. The main airport is about 50 km south, linked by the KLIA Ekspres train.",
  },
  {
    slug: "colombo",
    name: "Colombo",
    region: "Western Province",
    countryCode: "LK",
    countryName: "Sri Lanka",
    lat: 6.9271,
    lng: 79.8612,
    radiusKm: 25,
    nearestAirports: ["CMB"],
    summary:
      "Colombo is the largest city and commercial capital of Sri Lanka, on the west coast. Bandaranaike International Airport is about 30 km north, at Katunayake.",
  },
  {
    slug: "kathmandu",
    name: "Kathmandu",
    region: "Bagmati",
    countryCode: "NP",
    countryName: "Nepal",
    lat: 27.7172,
    lng: 85.324,
    radiusKm: 20,
    nearestAirports: ["KTM"],
    summary:
      "Kathmandu is the capital of Nepal, in a valley at about 1,400 metres. The valley has seven UNESCO listed monument zones, among them the Durbar squares, Swayambhunath and Boudhanath.",
  },
  {
    slug: "male",
    name: "Malé",
    region: null,
    countryCode: "MV",
    countryName: "Maldives",
    lat: 4.1755,
    lng: 73.5093,
    radiusKm: 40,
    nearestAirports: ["MLE"],
    summary:
      "Malé is the capital of the Maldives, on a small and densely built island. The international airport is on Hulhulé island next door, and most resorts are reached from there by speedboat or seaplane.",
  },
  {
    slug: "london",
    name: "London",
    region: "England",
    countryCode: "GB",
    countryName: "United Kingdom",
    lat: 51.5074,
    lng: -0.1278,
    radiusKm: 30,
    nearestAirports: ["LHR", "LGW", "LCY", "STN", "LTN"],
    summary:
      "London is the capital of the United Kingdom, on the River Thames. Six airports serve the city; Heathrow is the largest. The Underground and Overground reach most areas.",
  },
  {
    slug: "paris",
    name: "Paris",
    region: "Île-de-France",
    countryCode: "FR",
    countryName: "France",
    lat: 48.8566,
    lng: 2.3522,
    radiusKm: 25,
    nearestAirports: ["CDG", "ORY"],
    summary:
      "Paris is the capital of France, on the Seine. The city is divided into 20 numbered arrondissements, all reached by the Métro. Charles de Gaulle and Orly are its main airports.",
  },
  {
    slug: "istanbul",
    name: "Istanbul",
    region: null,
    countryCode: "TR",
    countryName: "Türkiye",
    lat: 41.0082,
    lng: 28.9784,
    radiusKm: 35,
    nearestAirports: ["IST", "SAW"],
    summary:
      "Istanbul is the largest city in Türkiye and spans the Bosphorus, with districts in both Europe and Asia. The historic peninsula, with Hagia Sophia, the Blue Mosque and Topkapı Palace, is a UNESCO World Heritage Site.",
  },
  {
    slug: "tokyo",
    name: "Tokyo",
    region: null,
    countryCode: "JP",
    countryName: "Japan",
    lat: 35.6762,
    lng: 139.6503,
    radiusKm: 35,
    nearestAirports: ["HND", "NRT"],
    summary:
      "Tokyo is the capital of Japan. Haneda Airport is close to the city and Narita is about 60 km east; both have rail links to the centre. Shinjuku, Shibuya and Asakusa are among its best known districts.",
  },
  {
    slug: "hanoi",
    name: "Hanoi",
    region: null,
    countryCode: "VN",
    countryName: "Vietnam",
    lat: 21.0278,
    lng: 105.8342,
    radiusKm: 25,
    nearestAirports: ["HAN"],
    summary:
      "Hanoi is the capital of Vietnam, on the Red River. The Old Quarter, north of Hoan Kiem Lake, keeps narrow streets named after the trades once carried out on them.",
  },
  {
    slug: "abu-dhabi",
    name: "Abu Dhabi",
    region: "Abu Dhabi",
    countryCode: "AE",
    countryName: "United Arab Emirates",
    lat: 24.4539,
    lng: 54.3773,
    radiusKm: 35,
    nearestAirports: ["AUH"],
    summary:
      "Abu Dhabi is the capital of the United Arab Emirates, on an island in the Persian Gulf. The Sheikh Zayed Grand Mosque and the Louvre Abu Dhabi on Saadiyat Island are its best known sights.",
  },
];

/** Inserts or updates every destination. Safe to run repeatedly. */
export async function seedDestinations(db: SeedDb) {
  await db
    .insert(destinations)
    .values(destinationSeeds.map((d) => ({ ...d, featured: d.featured ?? false })))
    .onConflictDoUpdate({
      target: destinations.slug,
      set: {
        name: sql`excluded.name`,
        region: sql`excluded.region`,
        countryCode: sql`excluded.country_code`,
        countryName: sql`excluded.country_name`,
        lat: sql`excluded.lat`,
        lng: sql`excluded.lng`,
        radiusKm: sql`excluded.radius_km`,
        nearestAirports: sql`excluded.nearest_airports`,
        summary: sql`excluded.summary`,
        featured: sql`excluded.featured`,
        updatedAt: sql`now()`,
      },
    });
  return destinationSeeds.length;
}
