import { describe, it, expect, afterEach } from "vitest";
import { appUrl, reviewLink } from "./reviewRequests";

const ORIG = process.env.NEXT_PUBLIC_APP_URL;
afterEach(() => {
  if (ORIG === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIG;
});

describe("review-request links", () => {
  it("uses NEXT_PUBLIC_APP_URL and strips a trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com/";
    expect(appUrl()).toBe("https://example.com");
  });

  it("falls back to skirrnow.com when unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(appUrl()).toBe("https://skirrnow.com");
  });

  it("builds a tracked review link from a token", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://skirrnow.com";
    expect(reviewLink("abc-123")).toBe("https://skirrnow.com/r/abc-123");
  });
});
