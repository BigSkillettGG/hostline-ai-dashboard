import { describe, expect, it } from "vitest";
import {
  captureReservationDetails,
  captureReservationRequest,
  completeReservationRequestFromDetails,
  hasReservationIntent,
  mergeReservationDetails,
} from "./reservation-intake";

const now = new Date(2026, 4, 5, 12, 0, 0);

describe("reservation intake", () => {
  it("captures a full reservation request from a single caller utterance", () => {
    const request = captureReservationRequest(
      "I'd like to book a table for four this Friday at 7:30 pm under Marcus Webb for a birthday.",
      { now },
    );

    expect(request).toEqual({
      confidence: 95,
      date: "2026-05-08",
      guestName: "Marcus Webb",
      notes: "Birthday",
      partySize: 4,
      time: "19:30",
    });
  });

  it("captures follow-up details after reservation intent has already been established", () => {
    const request = captureReservationRequest("Friday at 7 for four people under Nina", {
      now,
      requireIntent: false,
    });

    expect(request).toMatchObject({
      date: "2026-05-08",
      guestName: "Nina",
      partySize: 4,
      time: "19:00",
    });
  });

  it("captures lowercase guest names from phone transcripts", () => {
    const request = captureReservationRequest("book a table for two tonight at 6 under priya shah", { now });

    expect(request).toMatchObject({
      date: "2026-05-05",
      guestName: "Priya Shah",
      partySize: 2,
      time: "18:00",
    });
  });

  it("parses relative dates and explicit times", () => {
    const request = captureReservationRequest("Can I reserve a table for two tomorrow at 6pm?", { now });

    expect(request).toMatchObject({
      date: "2026-05-06",
      partySize: 2,
      time: "18:00",
    });
  });

  it("parses numeric dates and noon/midnight periods", () => {
    const request = captureReservationRequest("Book a table for 3 on 5/10 at 12:15 pm under Sarah.", { now });

    expect(request).toMatchObject({
      date: "2026-05-10",
      guestName: "Sarah",
      partySize: 3,
      time: "12:15",
    });
  });

  it("uses safer implied restaurant time defaults", () => {
    expect(captureReservationRequest("Book a table for two tonight at 7 under Priya", { now })).toMatchObject({
      time: "19:00",
    });
    expect(captureReservationRequest("Book a table for two tomorrow at 11 under Priya", { now })).toMatchObject({
      time: "11:00",
    });
    expect(captureReservationRequest("Book a table for two tomorrow at 12 under Priya", { now })).toMatchObject({
      time: "12:00",
    });
  });

  it("distinguishes this weekday from next weekday", () => {
    const wednesday = new Date(2026, 4, 6, 12, 0, 0);

    expect(captureReservationRequest("Book a table for two this Saturday at 7 under Priya", { now: wednesday })).toMatchObject({
      date: "2026-05-09",
    });
    expect(captureReservationRequest("Book a table for two next Saturday at 7 under Priya", { now: wednesday })).toMatchObject({
      date: "2026-05-16",
    });
  });

  it("returns null when required details are missing", () => {
    expect(captureReservationRequest("I'd like a reservation.", { now })).toBeNull();
    expect(captureReservationRequest("Friday at 7 for four.", { now })).toBeNull();
  });

  it("captures partial details so follow-up turns can complete a reservation naturally", () => {
    const firstTurn = captureReservationDetails("Do you have availability for a reservation at 6pm tonight?", { now });
    const secondTurn = captureReservationDetails("Two", {
      allowBarePartySize: true,
      now,
      requireIntent: false,
    });
    const request = completeReservationRequestFromDetails(mergeReservationDetails(firstTurn ?? undefined, secondTurn));

    expect(firstTurn).toMatchObject({
      date: "2026-05-05",
      time: "18:00",
    });
    expect(secondTurn).toMatchObject({
      partySize: 2,
    });
    expect(request).toMatchObject({
      date: "2026-05-05",
      partySize: 2,
      time: "18:00",
    });
  });

  it("detects reservation intent", () => {
    expect(hasReservationIntent("Can I book a table?")).toBe(true);
    expect(hasReservationIntent("I want a pizza.")).toBe(false);
  });
});
