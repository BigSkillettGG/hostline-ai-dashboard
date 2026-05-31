import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom({ message = "kaboom" }: { message?: string }): never {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs caught errors to console.error; silence it for clean output.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>healthy content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("healthy content")).toBeInTheDocument();
  });

  it("shows the recovery UI when a child throws", () => {
    render(
      <ErrorBoundary scopeLabel="dashboard">
        <Boom message="render failed" />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/render failed/)).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("recovers when the reset key changes", () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/app/calls">
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Simulate navigating to a different route with healthy content.
    rerender(
      <ErrorBoundary resetKey="/app/orders">
        <div>new page</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("new page")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("renders a custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={(error) => <div>custom: {error.message}</div>}>
        <Boom message="oops" />
      </ErrorBoundary>,
    );
    expect(screen.getByText("custom: oops")).toBeInTheDocument();
  });
});
