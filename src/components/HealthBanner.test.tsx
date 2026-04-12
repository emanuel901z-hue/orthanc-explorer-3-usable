import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { HealthBanner } from "./HealthBanner";
import { healthTracker } from "@/lib/health";

describe("HealthBanner", () => {
  beforeEach(() => healthTracker.reset());

  it("hides when status is unknown", () => {
    render(<HealthBanner />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows when degraded", () => {
    render(<HealthBanner />);
    act(() => {
      healthTracker.recordFailure();
      healthTracker.recordFailure();
      healthTracker.recordFailure();
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
