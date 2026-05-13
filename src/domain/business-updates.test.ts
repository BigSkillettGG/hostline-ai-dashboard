import { describe, expect, it } from "vitest";
import {
  buildBusinessLiveContext,
  createTemporaryUpdate,
  isExpiredTemporaryUpdate,
  resolveTemporaryUpdateExpiration,
  summarizeLiveContext,
  type TemporaryBusinessUpdate,
} from "./business-updates";

const now = new Date("2026-05-13T16:00:00.000Z");

describe("business updates", () => {
  it("builds an instruction block with mode and active updates", () => {
    const update = createTemporaryUpdate({
      body: "Tell callers the special is lobster ravioli while it lasts.",
      expiration: "today_close",
      id: "upd_1",
      now,
      title: "Tonight's special",
      type: "special",
    });
    const context = buildBusinessLiveContext({
      mode: "busy",
      now,
      updates: [update],
    });

    expect(context.activeMode.label).toBe("Busy");
    expect(context.activeUpdates).toHaveLength(1);
    expect(context.instructionBlock).toContain("Business mode: Busy");
    expect(context.instructionBlock).toContain("lobster ravioli");
    expect(summarizeLiveContext(context)).toContain("Busy mode");
  });

  it("separates expired updates from active updates", () => {
    const expired: TemporaryBusinessUpdate = {
      body: "Closed yesterday.",
      createdAt: "2026-05-12T12:00:00.000Z",
      expiration: "custom",
      expiresAt: "2026-05-12T23:59:00.000Z",
      id: "old",
      title: "Old closure",
      type: "closure",
    };
    const active: TemporaryBusinessUpdate = {
      body: "Running twenty minutes behind.",
      createdAt: "2026-05-13T15:00:00.000Z",
      expiration: "until_cleared",
      id: "active",
      title: "Running behind",
      type: "staffing",
    };
    const context = buildBusinessLiveContext({
      mode: "staffing_shortage",
      now,
      updates: [expired, active],
    });

    expect(context.activeUpdates.map((item) => item.id)).toEqual(["active"]);
    expect(context.expiredUpdates.map((item) => item.id)).toEqual(["old"]);
    expect(isExpiredTemporaryUpdate(expired, now)).toBe(true);
  });

  it("only applies mode-scoped updates to the matching active mode", () => {
    const context = buildBusinessLiveContext({
      mode: "normal",
      now,
      updates: [
        createTemporaryUpdate({
          body: "Only use during busy mode.",
          expiration: "until_cleared",
          id: "busy-only",
          mode: "busy",
          now,
          title: "Busy note",
          type: "policy",
        }),
        createTemporaryUpdate({
          body: "Use in any mode.",
          expiration: "until_cleared",
          id: "all",
          now,
          title: "General note",
          type: "policy",
        }),
      ],
    });

    expect(context.activeUpdates.map((item) => item.id)).toEqual(["all"]);
  });

  it("resolves common expiration presets", () => {
    const todayClose = new Date(resolveTemporaryUpdateExpiration({ expiration: "today_close", now })!);
    const tomorrowClose = new Date(resolveTemporaryUpdateExpiration({ expiration: "tomorrow_close", now })!);

    expect(resolveTemporaryUpdateExpiration({ expiration: "until_cleared", now })).toBeUndefined();
    expect(todayClose.getHours()).toBe(23);
    expect(todayClose.getMinutes()).toBe(59);
    expect(tomorrowClose.getDate()).toBe(todayClose.getDate() + 1);
    expect(resolveTemporaryUpdateExpiration({
      customExpiresAt: "2026-05-15T18:30:00.000Z",
      expiration: "custom",
      now,
    })).toBe("2026-05-15T18:30:00.000Z");
  });
});
