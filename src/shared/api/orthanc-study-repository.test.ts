import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OrthancStudyRepository } from "./orthanc-study-repository";
import { studiesApi } from "@/api/studies";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

// Mock actions layer to reject if called — proves repo does NOT call actions layer
vi.mock("@/actions/sendStudy", () => ({
  sendStudyAction: vi
    .fn()
    .mockRejectedValue(
      new Error("actions layer must not be called from repo")
    ),
}));
vi.mock("@/actions/studyLabel", () => ({
  addLabelAction: vi
    .fn()
    .mockRejectedValue(
      new Error("actions layer must not be called from repo")
    ),
  removeLabelAction: vi
    .fn()
    .mockRejectedValue(
      new Error("actions layer must not be called from repo")
    ),
}));

const makeStudy = (id = "abc") => ({
  ID: id,
  IsStable: true,
  Labels: [],
  LastUpdate: "20230101T000000",
  MainDicomTags: {
    StudyDate: "20230101",
    StudyInstanceUID: "1.2.3",
    ModalitiesInStudy: "CT",
  },
  PatientMainDicomTags: {
    PatientID: "PAT001",
    PatientName: "Smith^John",
  },
  ParentPatient: "parent-id",
  Series: ["series-1"],
  Type: "Study" as const,
});

describe("OrthancStudyRepository", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: "",
      authMode: "none",
      features: {},
    };
    loadConfig();
  });

  afterEach(() => {
    __resetConfigForTests();
    vi.restoreAllMocks();
  });

  it("findAll delegates to studiesApi.find", async () => {
    const spy = vi.spyOn(studiesApi, "find").mockResolvedValue([]);
    const repo = new OrthancStudyRepository();
    const result = await repo.findAll({});
    expect(spy).toHaveBeenCalledWith({
      Level: "Study",
      Query: {},
      Expand: true,
      RequestedTags: ["ModalitiesInStudy", "BodyPartExamined", "NumberOfStudyRelatedInstances", "NumberOfStudyRelatedSeries"],
    });
    expect(result).toEqual([]);
  });

  it("findAll passes patientName filter as wildcard", async () => {
    const spy = vi.spyOn(studiesApi, "find").mockResolvedValue([]);
    const repo = new OrthancStudyRepository();
    await repo.findAll({ patientName: "Smith" });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ Query: { PatientName: "*Smith*" } })
    );
  });

  it("findById delegates to studiesApi.get and maps to Study shape", async () => {
    vi.spyOn(studiesApi, "get").mockResolvedValue(makeStudy("abc"));
    const repo = new OrthancStudyRepository();
    const result = await repo.findById("abc");
    expect(result).toBeDefined();
    expect(result?.id).toBe("abc");
    expect(result?.patientName).toBe("Smith^John");
    expect(result?.modalities).toContain("CT");
  });

  it("findById returns mapped study with correct studyDate", async () => {
    vi.spyOn(studiesApi, "get").mockResolvedValue(makeStudy("xyz"));
    const repo = new OrthancStudyRepository();
    const result = await repo.findById("xyz");
    expect(result?.studyDate).toBeInstanceOf(Date);
    expect(result?.studyDate.getFullYear()).toBe(2023);
  });
});

describe("OrthancStudyRepository — layering", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__OE3_CONFIG__ = {
      orthancUrl: "",
      authMode: "none",
      features: {},
    };
    loadConfig();
  });

  afterEach(() => {
    __resetConfigForTests();
    vi.restoreAllMocks();
  });

  it("sendToModality calls studiesApi directly, not sendStudyAction", async () => {
    vi.spyOn(studiesApi, "sendToModality").mockResolvedValue(undefined);
    const repo = new OrthancStudyRepository();
    await expect(repo.sendToModality("study-1", "PACS1")).resolves.toBeUndefined();
    expect(studiesApi.sendToModality).toHaveBeenCalledWith("study-1", "PACS1");
  });

  it("addLabel calls studiesApi directly, not addLabelAction", async () => {
    vi.spyOn(studiesApi, "addLabel").mockResolvedValue(undefined);
    const repo = new OrthancStudyRepository();
    await expect(repo.addLabel("study-1", "urgent")).resolves.toBeUndefined();
    expect(studiesApi.addLabel).toHaveBeenCalledWith("study-1", "urgent");
  });

  it("removeLabel calls studiesApi directly, not removeLabelAction", async () => {
    vi.spyOn(studiesApi, "removeLabel").mockResolvedValue(undefined);
    const repo = new OrthancStudyRepository();
    await expect(repo.removeLabel("study-1", "urgent")).resolves.toBeUndefined();
    expect(studiesApi.removeLabel).toHaveBeenCalledWith("study-1", "urgent");
  });
});
