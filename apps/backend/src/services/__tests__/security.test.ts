import { UserRole } from "@prisma/client";
import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";

import { createRateLimiter } from "../../middlewares/rateLimit.js";
import { escapeHtml, sanitizeEmailHtml } from "../../utils/html.js";
import { canAccessLead } from "../../utils/leadAccess.js";
import { generatePassword } from "../../utils/password.js";

describe("Security utilities & access controls", () => {
  it("escapes HTML special characters and sanitizes dangerous email HTML", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );

    const dirty = `<div>Safe<script>alert('xss')</script><a href="javascript:alert(1)" onclick="steal()">Click</a><iframe src="https://evil.com"></iframe></div>`;
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("<iframe");
    expect(clean).toContain("Safe");
  });

  it("enforces partner and operator lead access boundaries in canAccessLead", () => {
    const lead = {
      partnerId: "partner-a",
      createdByUserId: "emp-1",
      assignedUser: { id: "op-1" },
    };

    expect(
      canAccessLead(lead, { id: "partner-user", role: UserRole.PARTNER, partnerId: "partner-a" }),
    ).toBe(true);
    expect(
      canAccessLead(lead, { id: "partner-user", role: UserRole.PARTNER, partnerId: "partner-b" }),
    ).toBe(false);
    expect(
      canAccessLead(lead, {
        id: "emp-2",
        role: UserRole.PARTNER_EMPLOYEE,
        partnerId: "partner-a",
      }),
    ).toBe(false);
    expect(
      canAccessLead(lead, { id: "op-2", role: UserRole.OPERATOR, partnerId: null }),
    ).toBe(false);
    expect(
      canAccessLead(lead, { id: "op-1", role: UserRole.OPERATOR, partnerId: null }),
    ).toBe(true);
    expect(
      canAccessLead(lead, { id: "admin-1", role: UserRole.ADMIN, partnerId: null }),
    ).toBe(true);
  });

  it("enforces rate limiting when enabled", () => {
    process.env.ENABLE_RATE_LIMIT_IN_TESTS = "true";
    try {
      const limiter = createRateLimiter({
        windowMs: 60_000,
        max: 2,
        keyPrefix: "test-sec",
      });

      const makeCall = () => {
        let statusCode = 200;
        let nextCalled = false;
        const req = { ip: "198.51.100.7" } as unknown as Request;
        const res = {
          setHeader: () => res,
          status: (code: number) => {
            statusCode = code;
            return res;
          },
          json: () => res,
        } as unknown as Response;

        limiter(req, res, () => {
          nextCalled = true;
        });

        return { statusCode, nextCalled };
      };

      expect(makeCall()).toEqual({ statusCode: 200, nextCalled: true });
      expect(makeCall()).toEqual({ statusCode: 200, nextCalled: true });
      expect(makeCall()).toEqual({ statusCode: 429, nextCalled: false });
    } finally {
      delete process.env.ENABLE_RATE_LIMIT_IN_TESTS;
    }
  });

  it("generates cryptographically random passwords of requested length", () => {
    const pwd1 = generatePassword(16);
    const pwd2 = generatePassword(16);
    expect(pwd1).toHaveLength(16);
    expect(pwd2).toHaveLength(16);
    expect(pwd1).not.toBe(pwd2);
  });
});
