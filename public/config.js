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
  // mwl-broker REST API — proxied same-origin by the Vite dev server.
  // Omit/remove to hide the broker feature entirely.
  brokerUrl: "/broker-api",
  authMode: "none",
  // Dev has no /oe3-me backend endpoint — skip the auth gate.
  authCheck: false,
  // Dev has no viewer-session endpoint either.
  viewerSession: false,
  features: {},
  branding: { title: "Orthanc Explorer 3 (Dev)", logoUrl: "/logo/oe3-logo-128.png" },
};
