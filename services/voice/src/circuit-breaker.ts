export class CircuitBreakerOpenError extends Error {
  constructor(readonly serviceName: string) {
    super(`${serviceName} circuit is open.`);
    this.name = "CircuitBreakerOpenError";
  }
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetAfterMs: number;
  serviceName: string;
}

export class CircuitBreaker {
  private failureCount = 0;
  private openedAt?: number;

  constructor(private readonly options: CircuitBreakerOptions) {}

  assertCanAttempt(now = Date.now()) {
    if (!this.openedAt) return;
    if (now - this.openedAt >= this.options.resetAfterMs) {
      this.failureCount = 0;
      this.openedAt = undefined;
      return;
    }
    throw new CircuitBreakerOpenError(this.options.serviceName);
  }

  recordSuccess() {
    this.failureCount = 0;
    this.openedAt = undefined;
  }

  recordFailure(now = Date.now()) {
    this.failureCount += 1;
    if (this.failureCount >= this.options.failureThreshold) {
      this.openedAt = now;
    }
  }

  reset() {
    this.failureCount = 0;
    this.openedAt = undefined;
  }
}
