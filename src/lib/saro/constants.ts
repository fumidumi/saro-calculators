export const VOLTAGE = 230;
export const RESERVE_FACTOR = 1.05;

export const SARO_ROOFTOP = {
  powerWm: 30,
  maxSectionLengthM: 105,
  startupCurrentPerMeterAtMinus15: 0.31,
  startupFactor: 2.5,
  recommendedBreakerForMaxSection: "C25",
  breakerCurve: "C",
} as const;

export const SARO_RESISTIVE = {
  powerWm: 30,
  availableLengthsM: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
  breakerCurve: "C",
  cuttable: false,
} as const;

export const SARO_CABINET = {
  maxWorkingCurrentPerPhaseA: 32,
  maxStartupCurrentA: 38,
  hasSinglePhase: true,
  hasThreePhase: true,
  contactorInside: true,
  versions: ["DIN", "outdoor"] as const,
};

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;
