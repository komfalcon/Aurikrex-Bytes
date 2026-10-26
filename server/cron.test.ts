import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isCronAuthorized } from "./_core/security.js";
import type { Request } from "express";

describe("isCronAuthorized", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const originalS2sSecret = process.env.AURIKREX_CENTRAL_S2S_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "quorex";
    delete process.env.AURIKREX_CENTRAL_S2S_SECRET;
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
    process.env.AURIKREX_CENTRAL_S2S_SECRET = originalS2sSecret;
  });

  it("authorizes valid Bearer Authorization header", () => {
    const req = {
      headers: { authorization: "Bearer quorex" },
      query: {},
    } as unknown as Request;
    expect(isCronAuthorized(req)).toBe(true);
  });

  it("authorizes raw Authorization header without Bearer prefix", () => {
    const req = {
      headers: { authorization: "quorex" },
      query: {},
    } as unknown as Request;
    expect(isCronAuthorized(req)).toBe(true);
  });

  it("authorizes X-Cron-Secret header", () => {
    const req = {
      headers: { "x-cron-secret": "quorex" },
      query: {},
    } as unknown as Request;
    expect(isCronAuthorized(req)).toBe(true);
  });

  it("authorizes query parameter secret or key", () => {
    const req1 = {
      headers: {},
      query: { secret: "quorex" },
    } as unknown as Request;
    expect(isCronAuthorized(req1)).toBe(true);

    const req2 = {
      headers: {},
      query: { key: "quorex" },
    } as unknown as Request;
    expect(isCronAuthorized(req2)).toBe(true);
  });

  it("trims enclosing quotes from environment secret", () => {
    process.env.CRON_SECRET = '"quorex"';
    const req = {
      headers: { authorization: "Bearer quorex" },
      query: {},
    } as unknown as Request;
    expect(isCronAuthorized(req)).toBe(true);
  });

  it("accepts AURIKREX_CENTRAL_S2S_SECRET as fallback", () => {
    delete process.env.CRON_SECRET;
    process.env.AURIKREX_CENTRAL_S2S_SECRET = "shared-central-secret";

    const req = {
      headers: { authorization: "Bearer shared-central-secret" },
      query: {},
    } as unknown as Request;
    expect(isCronAuthorized(req)).toBe(true);
  });

  it("rejects invalid secret or missing secret", () => {
    const req = {
      headers: { authorization: "Bearer wrong-secret" },
      query: {},
    } as unknown as Request;
    expect(isCronAuthorized(req)).toBe(false);
  });
});
