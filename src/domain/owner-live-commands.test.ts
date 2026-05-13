import { describe, expect, it } from "vitest";
import { parseOwnerLiveCommand } from "./owner-live-commands";

const now = new Date("2026-05-13T18:00:00.000Z");

describe("owner live commands", () => {
  it("turns a special into a temporary live update", () => {
    const command = parseOwnerLiveCommand("Tonight's special is lobster ravioli", now);

    expect(command?.kind).toBe("add_update");
    if (command?.kind !== "add_update") return;
    expect(command.update.type).toBe("special");
    expect(command.update.title).toBe("Tonight's special");
    expect(command.update.body).toContain("lobster ravioli");
    expect(command.update.source).toBe("owner_text");
  });

  it("turns a closure into a tomorrow-expiring update", () => {
    const command = parseOwnerLiveCommand("We are closed tomorrow for a private event", now);

    expect(command?.kind).toBe("add_update");
    if (command?.kind !== "add_update") return;
    expect(command.update.type).toBe("closure");
    expect(command.update.expiration).toBe("tomorrow_close");
    expect(command.update.title).toBe("Closed tomorrow");
  });

  it("captures running-behind updates as staffing-sensitive service status", () => {
    const command = parseOwnerLiveCommand("We're running 20 minutes behind tonight", now);

    expect(command?.kind).toBe("add_update");
    if (command?.kind !== "add_update") return;
    expect(command.update.type).toBe("service_status");
    expect(command.update.mode).toBe("staffing_shortage");
    expect(command.update.body).toContain("20 minutes behind");
  });

  it("sets business modes", () => {
    const command = parseOwnerLiveCommand("Set emergency mode", now);

    expect(command).toEqual({
      confirmation: "Got it. Emergency mode is now active for live customer conversations.",
      kind: "set_mode",
      mode: "emergency",
    });
  });

  it("ignores normal reporting questions", () => {
    expect(parseOwnerLiveCommand("What happened today?", now)).toBeNull();
  });
});
