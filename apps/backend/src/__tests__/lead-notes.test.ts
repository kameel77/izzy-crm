import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";

describe("lead note attachments security", () => {
  it("rejects download requests without authentication", async () => {
    const app = createApp();
    const response = await request(app).get(
      "/api/leads/test-lead/notes/test-note/attachments/test-attachment/download",
    );

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ message: expect.any(String) });
  });
});
