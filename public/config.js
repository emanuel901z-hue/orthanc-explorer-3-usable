// Dev placeholder runtime config.
// In production this file is replaced by the deployment target (standalone
// docker entrypoint, reverse proxy, or Orthanc plugin mount) to inject the
// correct orthancUrl / authMode / fhir / branding for that environment.
window.__OE3_CONFIG__ = {
  orthancUrl: "http://localhost:8042",
  authMode: "none",
  features: {},
  branding: { title: "Orthanc Explorer 3 (Dev)" },
};
