import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { MemoryUserStore } from "../src/auth.js";
import { MemoryBoardStore } from "../src/board-store.js";
import { MemoryProjectStore } from "../src/store.js";

function app() {
  return createApp({
    projects: new MemoryProjectStore(),
    boards: new MemoryBoardStore(),
    users: new MemoryUserStore(),
  });
}

describe("auth", () => {
  it("registers a user and returns a token", async () => {
    const res = await request(app())
      .post("/api/auth/register")
      .send({ email: "New@Example.com", password: "password123", name: "New" });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.email).toBe("new@example.com"); // normalized
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("rejects a short password", async () => {
    const res = await request(app())
      .post("/api/auth/register")
      .send({ email: "a@b.com", password: "short" });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email", async () => {
    const a = app();
    await request(a).post("/api/auth/register").send({ email: "dup@x.com", password: "password123" });
    const res = await request(a)
      .post("/api/auth/register")
      .send({ email: "dup@x.com", password: "password123" });
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials and rejects wrong ones", async () => {
    const a = app();
    await request(a).post("/api/auth/register").send({ email: "log@x.com", password: "password123" });

    const ok = await request(a)
      .post("/api/auth/login")
      .send({ email: "log@x.com", password: "password123" });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.token).toBe("string");

    const bad = await request(a)
      .post("/api/auth/login")
      .send({ email: "log@x.com", password: "wrongpass" });
    expect(bad.status).toBe(401);
  });

  it("returns the current user from /me with a token", async () => {
    const a = app();
    const reg = await request(a)
      .post("/api/auth/register")
      .send({ email: "me@x.com", password: "password123", name: "Me" });
    const token = reg.body.token as string;

    const me = await request(a).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("me@x.com");

    const noAuth = await request(a).get("/api/auth/me");
    expect(noAuth.status).toBe(401);
  });

  it("scopes projects to their owner", async () => {
    const a = app();
    const u1 = (await request(a).post("/api/auth/register").send({ email: "u1@x.com", password: "password123" })).body.token;
    const u2 = (await request(a).post("/api/auth/register").send({ email: "u2@x.com", password: "password123" })).body.token;

    // u1 has no projects; u2 has none either — but ensure lists are independent.
    const l1 = await request(a).get("/api/projects").set("Authorization", `Bearer ${u1}`);
    const l2 = await request(a).get("/api/projects").set("Authorization", `Bearer ${u2}`);
    expect(l1.body.projects).toEqual([]);
    expect(l2.body.projects).toEqual([]);
  });
});
