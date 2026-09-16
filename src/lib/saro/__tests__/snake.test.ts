import { describe, it, expect } from "vitest";
import {
  calculateActualSnakeStep,
  getResistiveSnakeAlternatives,
  buildSpecification,
} from "../calculations";
import type { ObjectStep, ZoneResult } from "../types";

describe("calculateActualSnakeStep", () => {
  it("returns step in cm based on edge length, width and section length", () => {
    // edge=10m, width=50cm (0.5m), section=50m -> (10*0.5*1.05)/50 = 0.105m = 10.5cm
    expect(calculateActualSnakeStep(10, 50, 50)).toBe(10.5);
  });

  it("returns 0 if any input is zero or missing", () => {
    expect(calculateActualSnakeStep(0, 50, 50)).toBe(0);
    expect(calculateActualSnakeStep(10, 0, 50)).toBe(0);
    expect(calculateActualSnakeStep(10, 50, 0)).toBe(0);
  });

  it("longer section produces smaller step", () => {
    const stepShort = calculateActualSnakeStep(20, 50, 60);
    const stepLong = calculateActualSnakeStep(20, 50, 120);
    expect(stepLong).toBeLessThan(stepShort);
  });
});

describe("getResistiveSnakeAlternatives", () => {
  it("returns the nearest lower and upper available section around calculated length", () => {
    // calculated length = 55m -> lower 50, upper 60
    const alts = getResistiveSnakeAlternatives(55, 10, 50);
    expect(alts.lower?.sectionLengthM).toBe(50);
    expect(alts.upper?.sectionLengthM).toBe(60);
    expect(alts.lower?.direction).toBe("lower");
    expect(alts.upper?.direction).toBe("upper");
  });

  it("returns equal lower and upper when calculated length matches a section", () => {
    const alts = getResistiveSnakeAlternatives(60, 10, 50);
    expect(alts.lower?.sectionLengthM).toBe(60);
    expect(alts.upper?.sectionLengthM).toBe(60);
  });

  it("upper is null if calculated length exceeds maximum section", () => {
    const alts = getResistiveSnakeAlternatives(200, 30, 60);
    expect(alts.upper).toBeNull();
    expect(alts.lower?.sectionLengthM).toBe(120);
  });

  it("warns about a sparse step (>15 cm) for a too-short section", () => {
    // calculated=60, lower=60, edge=30m, width=50cm -> step = (30*0.5*1.05)/60 = 26.25cm -> sparse
    const alts = getResistiveSnakeAlternatives(60, 30, 50);
    expect(alts.lower?.actualStepCm).toBeGreaterThan(15);
    expect(alts.lower?.warnings.join(" ")).toMatch(/редкая укладка/i);
  });

  it("warns about a too-dense step (<8 cm)", () => {
    // calculated=120 -> upper=120, edge=5m, width=50cm -> step ≈ 2.2cm
    const alts = getResistiveSnakeAlternatives(120, 5, 50);
    const upper = alts.upper!;
    expect(upper.actualStepCm).toBeLessThan(8);
    expect(upper.warnings.join(" ")).toMatch(/плотная укладка/i);
  });
});

describe("buildSpecification — forbidden positions filter", () => {
  const obj: ObjectStep = {
    objectType: "private",
    roofType: "pitched",
    drainType: "external",
    automationPlace: "outdoor",
    powerChoice: "auto",
  };
  const zones: ZoneResult[] = [
    { key: "gutter", name: "Кровельный желоб", inputs: "10 м", rule: "3 нитки", length: 31.5, power: 945 },
  ];

  it("strips any 'монтажная лента/полоса' positions from fasteners", () => {
    const text = buildSpecification({
      obj,
      zones,
      cable: "rooftop",
      fasteners: [
        { zone: "Кровельный желоб", item: "Держатели / клипсы кабеля", quantity: 66, unit: "шт", note: "" },
        { zone: "Кровельный желоб", item: "Монтажная лента", quantity: 10, unit: "м", note: "" },
        { zone: "Капельник", item: "Полоса для фиксации кабеля", quantity: 5, unit: "шт", note: "" },
        { zone: "Карниз", item: "монтажная полоса нержавеющая", quantity: 3, unit: "шт", note: "" },
      ],
    });
    expect(text).toContain("Держатели / клипсы кабеля");
    expect(text.toLowerCase()).not.toContain("монтажная лента");
    expect(text.toLowerCase()).not.toContain("монтажная полоса");
    expect(text.toLowerCase()).not.toContain("полоса для фиксации");
  });
});
