import { describe, it, expect, afterEach } from "vitest";
import { activeProvider } from "./adapter";

const ORIG = process.env.GENERATION_PROVIDER;
afterEach(() => {
  if (ORIG === undefined) delete process.env.GENERATION_PROVIDER;
  else process.env.GENERATION_PROVIDER = ORIG;
});

describe("generation adapter", () => {
  it("defaults to the Higgsfield provider when no env is set", () => {
    delete process.env.GENERATION_PROVIDER;
    expect(activeProvider().id).toBe("higgsfield");
  });

  it("falls back to Higgsfield for an unknown provider id", () => {
    process.env.GENERATION_PROVIDER = "does-not-exist";
    expect(activeProvider().id).toBe("higgsfield");
  });

  it("estimates credits per kind (image cheaper than video)", () => {
    const p = activeProvider();
    expect(p.creditEstimate("image")).toBe(7);
    expect(p.creditEstimate("video")).toBe(30);
    expect(p.creditEstimate("image")).toBeLessThan(p.creditEstimate("video"));
  });

  it("maps a model per kind", () => {
    const p = activeProvider();
    expect(typeof p.modelFor("image")).toBe("string");
    expect(p.modelFor("image")).not.toBe(p.modelFor("video"));
  });
});
