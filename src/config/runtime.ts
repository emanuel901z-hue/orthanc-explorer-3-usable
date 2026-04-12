// src/config/runtime.ts
import { z } from "zod";

export const OE3ConfigSchema = z.object({
  orthancUrl: z.string(),
  authMode: z.enum(["none", "basic", "oidc", "smart"]),
  fhir: z.object({
    iss: z.string(),
    clientId: z.string(),
    scope: z.string(),
  }).optional(),
  features: z.record(z.string(), z.boolean()).default({}),
  branding: z.object({
    title: z.string(),
    logoUrl: z.string().optional(),
  }).optional(),
  frameAncestors: z.array(z.string()).optional(),
});

export type OE3Config = z.infer<typeof OE3ConfigSchema>;

let cached: OE3Config | null = null;

export function loadConfig(): OE3Config {
  const raw = (window as unknown as { __OE3_CONFIG__?: unknown }).__OE3_CONFIG__;
  cached = OE3ConfigSchema.parse(raw ?? {});
  return cached;
}

export function getConfig(): OE3Config {
  if (!cached) {
    throw new Error("Config not loaded. Call loadConfig() at app boot.");
  }
  return cached;
}

export function __resetConfigForTests(): void {
  cached = null;
}
