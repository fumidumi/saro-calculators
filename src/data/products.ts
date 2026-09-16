export interface Product {
  id: string;
  name: string;
  article: string;
  price: number;
  image: string;
  category: 'cable' | 'thermostat' | 'cabinet' | 'tape';
}

export interface HeatingCable extends Product {
  category: 'cable';
  length: number;
  power: number;
}

export interface Thermostat extends Product {
  category: 'thermostat';
  maxAmperage: number;
  type: 'wall' | 'din' | 'outdoor';
}

export interface ControlCabinet extends Product {
  category: 'cabinet';
  maxAmperage: number;
}

export interface MountingTape extends Product {
  category: 'tape';
  length: number;
}

export const HEATING_CABLES: HeatingCable[] = [
  {
    id: "TS-46232",
    name: "Секция нагревательная SARO Efrost 150 W",
    length: 5,
    power: 150,
    article: "TS-46232",
    price: 4320,
    image: "/placeholder.svg",
    category: 'cable'
  },
  {
    id: "TS-46233",
    name: "Секция нагревательная SARO Efrost 300 W",
    length: 10,
    power: 300,
    article: "TS-46233",
    price: 5880,
    image: "/placeholder.svg",
    category: 'cable'
  },
  {
    id: "TS-46234",
    name: "Секция нагревательная SARO Efrost 450 W",
    length: 15,
    power: 450,
    article: "TS-46234",
    price: 7530,
    image: "/placeholder.svg",
    category: 'cable'
  },
  {
    id: "TS-46235",
    name: "Секция нагревательная SARO Efrost 600 W",
    length: 20,
    power: 600,
    article: "TS-46235",
    price: 9108,
    image: "/placeholder.svg",
    category: 'cable'
  },
  {
    id: "TS-46236",
    name: "Секция нагревательная SARO Efrost 900 W",
    length: 30,
    power: 900,
    article: "TS-46236",
    price: 11880,
    image: "/placeholder.svg",
    category: 'cable'
  },
  {
    id: "TS-46237",
    name: "Секция нагревательная SARO Efrost 1200 W",
    length: 40,
    power: 1200,
    article: "TS-46237",
    price: 15180,
    image: "/placeholder.svg",
    category: 'cable'
  },
  {
    id: "TS-46238",
    name: "Секция нагревательная SARO Efrost 1500 W",
    length: 50,
    power: 1500,
    article: "TS-46238",
    price: 18964,
    image: "/placeholder.svg",
    category: 'cable'
  },
  {
    id: "TS-46239",
    name: "Секция нагревательная SARO Efrost 1800 W",
    length: 60,
    power: 1800,
    article: "TS-46239",
    price: 21340,
    image: "/placeholder.svg",
    category: 'cable'
  },
  {
    id: "TS-46240",
    name: "Секция нагревательная SARO Efrost 2100 W",
    length: 70,
    power: 2100,
    article: "TS-46240",
    price: 24200,
    image: "/placeholder.svg",
    category: 'cable'
  },
  {
    id: "TS-46241",
    name: "Секция нагревательная SARO Efrost 2400 W",
    length: 80,
    power: 2400,
    article: "TS-46241",
    price: 27720,
    image: "/placeholder.svg",
    category: 'cable'
  },
  {
    id: "TS-46242",
    name: "Секция нагревательная SARO Efrost 2700 W",
    length: 90,
    power: 2700,
    article: "TS-46242",
    price: 30800,
    image: "/placeholder.svg",
    category: 'cable'
  },
  {
    id: "TS-46243",
    name: "Секция нагревательная SARO Efrost 3000 W",
    length: 100,
    power: 3000,
    article: "TS-46243",
    price: 33880,
    image: "/placeholder.svg",
    category: 'cable'
  },
  {
    id: "TS-46244",
    name: "Секция нагревательная SARO Efrost 3300 W",
    length: 110,
    power: 3300,
    article: "TS-46244",
    price: 37400,
    image: "/placeholder.svg",
    category: 'cable'
  },
  {
    id: "TS-46245",
    name: "Секция нагревательная SARO Efrost 3600 W",
    length: 120,
    power: 3600,
    article: "TS-46245",
    price: 40700,
    image: "/placeholder.svg",
    category: 'cable'
  }
];

export const THERMOSTATS: Thermostat[] = [
  {
    id: "SARO-OM24",
    name: "Терморегулятор SARO OM-24",
    article: "SARO-OM24",
    price: 5880,
    image: "/placeholder.svg",
    category: 'thermostat',
    maxAmperage: 16,
    type: 'wall'
  },
  {
    id: "SARO-OM24plus",
    name: "Терморегулятор SARO OM-24plus",
    article: "SARO-OM24plus",
    price: 24130,
    image: "/placeholder.svg",
    category: 'thermostat',
    maxAmperage: 16,
    type: 'wall'
  },
  {
    id: "SARO-BH",
    name: "Терморегулятор SARO 330d",
    article: "SARO-BH",
    price: 0,
    image: "/placeholder.svg",
    category: 'thermostat',
    maxAmperage: 16,
    type: 'din'
  },
  {
    id: "SARO-330",
    name: "Терморегулятор SARO MC-133",
    article: "SARO-MC133",
    price: 0,
    image: "/placeholder.svg",
    category: 'thermostat',
    maxAmperage: 16,
    type: 'din'
  }
];

export const CONTROL_CABINETS: ControlCabinet[] = [
  {
    id: "SHUSO-16",
    name: "Шкаф управления ШУСО-16",
    article: "ШУСО-16",
    price: 13207,
    image: "/placeholder.svg",
    category: 'cabinet',
    maxAmperage: 16
  },
  {
    id: "SHUSO-25",
    name: "Шкаф управления ШУСО-25",
    article: "ШУСО-25",
    price: 14081,
    image: "/placeholder.svg",
    category: 'cabinet',
    maxAmperage: 25
  }
];

export const MOUNTING_TAPES: MountingTape[] = [
  {
    id: "FIXTAPE-10",
    name: "Лента монтажная Fixtape",
    article: "FIXTAPE-10",
    price: 480,
    image: "/placeholder.svg",
    category: 'tape',
    length: 10
  }
];

// Функции для выбора оборудования по расчетам
export const selectThermostatByAmperage = (amperage: number): Thermostat | null => {
  return THERMOSTATS.find(t => t.maxAmperage >= amperage) || null;
};

export const selectCabinetByAmperage = (amperage: number): ControlCabinet | null => {
  return CONTROL_CABINETS.find(c => c.maxAmperage >= amperage) || null;
};

export const selectCableByLength = (requiredLength: number): HeatingCable | null => {
  return HEATING_CABLES.find(c => c.length >= requiredLength) || null;
};

export const calculateFixtapeRolls = (platformArea: number, stairsMeters: number): number => {
  const platformTape = platformArea * 2.5;
  const totalTape = platformTape + stairsMeters;
  return Math.ceil(totalTape / 10);
};
