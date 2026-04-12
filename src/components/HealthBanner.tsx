import { useEffect, useState } from "react";
import { healthTracker } from "@/lib/health";

export function HealthBanner() {
  const [status, setStatus] = useState(healthTracker.getState().status);
  useEffect(() => healthTracker.subscribe((s) => setStatus(s.status)), []);
  if (status !== "degraded") return null;
  return (
    <div role="alert" className="bg-destructive text-destructive-foreground px-4 py-2 text-sm">
      Connection to Orthanc is degraded. Data may be stale.
    </div>
  );
}
