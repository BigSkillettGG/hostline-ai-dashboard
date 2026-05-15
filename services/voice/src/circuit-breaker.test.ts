import { describe, expect, it } from "vitest";
import { CircuitBreaker, CircuitBreakerOpenError } from "./circuit-breaker";

describe("CircuitBreaker", () => {
  it("opens after repeated failures and resets after the cooldown", () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetAfterMs: 1000,
      serviceName: "test-service",
    });

    breaker.recordFailure(1000);
    expect(() => breaker.assertCanAttempt(1001)).not.toThrow();

    breaker.recordFailure(1002);
    expect(() => breaker.assertCanAttempt(1003)).toThrow(CircuitBreakerOpenError);
    expect(() => breaker.assertCanAttempt(2103)).not.toThrow();
  });
});
