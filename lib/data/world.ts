/**
 * world.ts — the one place that defines where things are.
 * country > city > building > department. Tickets point at a department id;
 * the map, ticket location text and open-ticket counts are all derived from this tree.
 */
export type Tone = "blue" | "violet" | "teal";

export interface Dept {
  id: string;
  name: string;
  devices: number;
  switches: number;
}
export interface Building {
  id: string;
  name: string;
  kind: string;
  departments: Dept[];
}
export interface City {
  id: string;
  name: string;
  sites: number;
  buildings: Building[];
}
export interface Country {
  id: string;
  name: string;
  code: string;
  tone: Tone;
  /** position on the world map, in % */
  x: number;
  y: number;
  cities: City[];
}

const dept = (id: string, name: string, devices = 6, switches = 1): Dept => ({ id, name, devices, switches });

export const world: Country[] = [
  {
    id: "us", name: "United States", code: "US", tone: "blue", x: 25, y: 39,
    cities: [{
      id: "aus", name: "Austin", sites: 12,
      buildings: [{
        id: "northstar", name: "Northstar Health", kind: "HEALTHCARE",
        departments: [dept("aus-fin", "Finance"), dept("aus-hr", "Human Resources"), dept("aus-it", "IT · Server Room", 12, 2)],
      }],
    }],
  },
  {
    id: "de", name: "Germany", code: "DE", tone: "violet", x: 53, y: 29,
    cities: [{
      id: "muc", name: "Munich", sites: 8,
      buildings: [{
        id: "aerologix", name: "AeroLogix Campus", kind: "LOGISTICS",
        departments: [dept("muc-wh", "Warehouse"), dept("muc-sales", "Sales"), dept("muc-it", "IT · Server Room", 12, 2)],
      }],
    }],
  },
  {
    id: "in", name: "India", code: "IN", tone: "teal", x: 67, y: 55,
    cities: [{
      id: "blr", name: "Bengaluru", sites: 16,
      buildings: [{
        id: "meridian", name: "Meridian Bank HQ", kind: "FINANCIAL SERVICES",
        departments: [
          dept("blr-hr", "Human Resources"), dept("blr-fin", "Finance"), dept("blr-sales", "Sales"),
          dept("blr-it", "IT · Server Room", 12, 2), dept("blr-wifi", "Guest Wi-Fi"),
        ],
      }],
    }],
  },
];

export interface Place {
  country: Country;
  city: City;
  building: Building;
  dept: Dept;
}

/** find where a department lives */
export function placeOf(deptId: string): Place {
  for (const country of world)
    for (const city of country.cities)
      for (const building of city.buildings) {
        const d = building.departments.find((x) => x.id === deptId);
        if (d) return { country, city, building, dept: d };
      }
  throw new Error(`Unknown department id: ${deptId}`);
}

export const locationLabel = (p: Place) => `${p.city.name} · ${p.country.name}`;
