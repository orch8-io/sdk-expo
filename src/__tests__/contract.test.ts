import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ORCH8_API_VERSION, ORCH8_ROUTES } from "../generated/routes.js";

describe("generated SDK contract", () => {
  it("contains the engine operations and shared transport fixture", () => {
    const fixture = JSON.parse(
      readFileSync(new URL("../../testdata/transport.json", import.meta.url), "utf8"),
    );
    expect(ORCH8_API_VERSION).toBe("1.0.0");
    expect(ORCH8_ROUTES.length).toBeGreaterThan(100);
    expect(ORCH8_ROUTES.some((route) => route.path === "/instances/{id}/stream")).toBe(true);
    expect(fixture.defaults.max_attempts).toBe(3);
  });
});
