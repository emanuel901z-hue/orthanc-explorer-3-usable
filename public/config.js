// Dev placeholder runtime config.
// In production this file is replaced by the deployment target (standalone
// docker entrypoint, reverse proxy, or Orthanc plugin mount) to inject the
// correct orthancUrl / authMode / fhir / branding for that environment.
window.__OE3_CONFIG__ = {
  // "/orthanc-proxy" is rewritten to "" by the Vite dev server proxy
  // (see vite.config.ts). This keeps all Orthanc requests same-origin,
  // avoiding CORS entirely during local development.
  // In production replace with an absolute URL or "" (plugin/same-origin mode).
  orthancUrl: "/orthanc-proxy",
  authMode: "none",
  features: {},
  branding: { title: "Orthanc Explorer 3 (Dev)", logoUrl: "/logo/oe3-logo-128.png" },
};
