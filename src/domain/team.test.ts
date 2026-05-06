import { describe, expect, it } from "vitest";
import { createPendingTeamInvitation, getInitials, normalizeInviteEmail } from "./team";

describe("team helpers", () => {
  it("normalizes invite emails", () => {
    expect(normalizeInviteEmail("  OWNER@Example.COM ")).toBe("owner@example.com");
    expect(() => normalizeInviteEmail("not-an-email")).toThrow("valid email");
  });

  it("creates pending team invitations with seven day expirations", () => {
    const invite = createPendingTeamInvitation(
      { email: "chef@example.com", invitedBy: "Maria", role: "manager" },
      new Date("2026-05-06T12:00:00.000Z"),
    );

    expect(invite).toMatchObject({
      createdAt: "2026-05-06T12:00:00.000Z",
      email: "chef@example.com",
      expiresAt: "2026-05-13T12:00:00.000Z",
      invitedBy: "Maria",
      role: "manager",
      status: "pending",
    });
  });

  it("builds fallback initials from names or emails", () => {
    expect(getInitials("Maria Lombardi")).toBe("ML");
    expect(getInitials("chef@example.com")).toBe("CE");
  });
});
