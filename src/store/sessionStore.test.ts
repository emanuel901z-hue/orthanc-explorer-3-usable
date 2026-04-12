// src/store/sessionStore.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStore } from "./sessionStore";

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.setState({ currentStudyId: null, currentSeriesId: null });
  });

  it("does not persist to localStorage", () => {
    useSessionStore.getState().setCurrentStudyId("abc");
    expect(localStorage.getItem("oe3-session")).toBeNull();
  });

  it("stores currentStudyId in memory", () => {
    useSessionStore.getState().setCurrentStudyId("study-xyz");
    expect(useSessionStore.getState().currentStudyId).toBe("study-xyz");
  });
});
