import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OrthancStudyRepository } from "./orthanc-study-repository";
import { studiesApi } from "@/api/studies";
import { loadConfig, __resetConfigForTests } from "@/config/runtime";

const makeStudy = (id = "abc") => ({
  ID: id,
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
      RequestedTags: ["ModalitiesInStudy", "BodyPartExamined"],
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
