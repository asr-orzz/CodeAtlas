import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyzeProject } from "@archx/analyzer";
import type { SourceAnalysis } from "@archx/analyzer";

let dir: string;
let analysis: SourceAnalysis;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "archx-ta-"));
  fs.writeFileSync(
    path.join(dir, "types.ts"),
    `
export type Role = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
};

export type ChatState = {
  messages: ChatMessage[];
  send(text: string): void;
};

type Base = { id: string };
export type Admin = Base & { level: number };
`,
    "utf8",
  );
  analysis = analyzeProject(dir);
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("type alias extraction", () => {
  it("captures object-literal type aliases as interface-shaped nodes", () => {
    const names = analysis.interfaces.map((i) => i.name).sort();
    expect(names).toEqual(["Admin", "Base", "ChatMessage", "ChatState"]);
  });

  it("skips pure union / primitive aliases", () => {
    expect(analysis.interfaces.some((i) => i.name === "Role")).toBe(false);
  });

  it("records members with their types", () => {
    const msg = analysis.interfaces.find((i) => i.name === "ChatMessage")!;
    expect(msg.properties.map((p) => p.name).sort()).toEqual([
      "content",
      "id",
      "role",
    ]);
    const state = analysis.interfaces.find((i) => i.name === "ChatState")!;
    expect(state.methods.map((m) => m.name)).toContain("send");
    expect(state.properties.find((p) => p.name === "messages")?.type).toBe(
      "ChatMessage[]",
    );
  });

  it("turns intersection members into extends links", () => {
    const admin = analysis.interfaces.find((i) => i.name === "Admin")!;
    expect(admin.extends).toContain("Base");
    expect(admin.properties.map((p) => p.name)).toContain("level");
  });
});
