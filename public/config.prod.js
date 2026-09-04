// Production config example for OE3
// orthancUrl points to the backend proxy which enforces JWT auth + MFA + RBAC.
// All Orthanc REST API calls go through /api/v1/pacs/orthanc/...
//
// authMode "none" means OE3 does not add its own auth headers.
// Auth is handled by the backend proxy (JWT cookie + Bearer token).
// The backend proxy injects the Orthanc admin credentials internally.
window.__OE3_CONFIG__ = {
  orthancUrl: "/api/v1/pacs/orthanc",
  authMode: "none",
  features: {
    enableUpload: true,
    enableModalityConfig: true,
    enableAnonymize: false,
    enableDelete: false,
    enableModify: false,
    enableSendTo: false,
  },
  branding: {
    title: "Orthanc Explorer 3",
    logoUrl: "/oe3/logo/oe3-logo-128.png",
  },
};
