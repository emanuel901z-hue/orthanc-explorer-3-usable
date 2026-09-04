import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { loadConfig } from "@/config/runtime";
import { useUiStore } from "@/store/ui-store";

try {
  const cfg = loadConfig();
  if (cfg.branding?.logoUrl) {
    useUiStore.getState().setLogoUrl(cfg.branding.logoUrl);
  }
  createRoot(document.getElementById("root")!).render(<App />);
} catch (err) {
  const message =
    err instanceof Error ? err.message : "Unknown runtime configuration error.";
  document.body.innerHTML = `
    <div style="
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 640px;
      margin: 8rem auto;
      padding: 2rem;
      border: 1px solid #f0c2c2;
      border-radius: 8px;
      background: #fff6f6;
      color: #7a1414;
    ">
      <h1 style="margin:0 0 0.5rem 0;font-size:1.25rem;">Orthanc Explorer 3 failed to start</h1>
      <p style="margin:0 0 1rem 0;">The runtime configuration file could not be loaded or is invalid.</p>
      <pre style="
        background:#fff;
        padding:0.75rem;
        border-radius:4px;
        overflow:auto;
        font-size:0.85rem;
        white-space:pre-wrap;
      ">${message.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</pre>
      <p style="margin:1rem 0 0 0;font-size:0.85rem;color:#555;">
        Verify that <code>/config.js</code> is being served and that
        <code>window.__OE3_CONFIG__</code> matches the expected schema.
      </p>
    </div>
  `;
}
