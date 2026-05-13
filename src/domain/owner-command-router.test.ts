import { describe, expect, it } from "vitest";
import { defaultTrustedContactPermissions } from "./trusted-contacts";
import { parsePermanentKnowledgeFact, routeOwnerCommand } from "./owner-command-router";

const now = new Date("2026-05-13T18:00:00.000Z");

describe("owner command router", () => {
  it("routes live updates through the shared owner command path", () => {
    const route = routeOwnerCommand({
      actor: { permissions: defaultTrustedContactPermissions("owner") },
      message: "We're closed tomorrow for a private event",
      now,
    });

    expect(route).toMatchObject({
      decision: "allowed",
      kind: "live_command",
    });
    if (route.kind !== "live_command" || route.command.kind !== "add_update") return;
    expect(route.command.update.title).toBe("Closed tomorrow");
  });

  it("requires approval for manager live updates and permanent knowledge", () => {
    const liveRoute = routeOwnerCommand({
      actor: { permissions: defaultTrustedContactPermissions("manager") },
      message: "Tonight's special is lobster ravioli",
      now,
    });
    const knowledgeRoute = routeOwnerCommand({
      actor: { permissions: defaultTrustedContactPermissions("manager") },
      message: "Remember that the bathroom is white",
      now,
    });

    expect(liveRoute).toMatchObject({ decision: "approval_required", kind: "live_command" });
    expect(knowledgeRoute).toMatchObject({ decision: "approval_required", kind: "knowledge_update" });
  });

  it("keeps reporting questions as report queries", () => {
    expect(
      routeOwnerCommand({
        actor: { permissions: defaultTrustedContactPermissions("owner") },
        message: "Any urgent calls today?",
      }),
    ).toMatchObject({
      decision: "allowed",
      kind: "report_query",
    });
  });

  it("parses explicit and simple declarative knowledge facts", () => {
    expect(parsePermanentKnowledgeFact("Remember that the bathroom is white")).toMatchObject({
      answer: "The bathroom is white.",
      title: "Owner note - The bathroom is white",
    });
    expect(parsePermanentKnowledgeFact("the patio has heaters")).toMatchObject({
      answer: "The patio has heaters.",
    });
    expect(parsePermanentKnowledgeFact("What happened today?")).toBeNull();
  });

  it("denies contacts without owner assistant access", () => {
    expect(
      routeOwnerCommand({
        actor: { permissions: defaultTrustedContactPermissions("billing") },
        message: "Set busy mode",
      }),
    ).toMatchObject({
      decision: "denied",
      kind: "denied",
    });
  });
});
