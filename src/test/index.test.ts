import { expect, it, describe } from "vitest";
import app from "../index";
import { mockEnv, ADMIN_TOKEN, ALLOWED_ORIGIN } from "./mock";

describe("Kevi Integration Tests", () => {
  it("GET - Success", async () => {
    const res = await app.request(
      "/v1/kv/test-key",
      {
        headers: {
          "X-Kevi-Token": ADMIN_TOKEN,
          Origin: ALLOWED_ORIGIN,
        },
      },
      mockEnv,
    );

    expect(res.status).toBe(200);
  });

  it("POST - CSRF Block", async () => {
    const res = await app.request(
      "/v1/kv/test-key",
      {
        method: "POST",
        headers: {
          "X-Kevi-Token": ADMIN_TOKEN,
          Origin: "http://evil.com",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: "data" }),
      },
      mockEnv,
    );

    expect(res.status).toBe(403);
  });

  it("POST - XSS Storage Success", async () => {
    const res = await app.request(
      "/v1/kv/xss",
      {
        method: "POST",
        headers: {
          "X-Kevi-Token": ADMIN_TOKEN,
          Origin: ALLOWED_ORIGIN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: "<script>alert(1)</script>" }),
      },
      mockEnv,
    );

    if (res.status !== 200) {
      const error = await res.json();
      console.log("Error Detail:", error);
    }

    expect(res.status).toBe(200);
  });
});
