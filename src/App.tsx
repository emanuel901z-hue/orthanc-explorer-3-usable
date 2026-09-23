import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProviders } from "@/app/providers/AppProviders";
import { AuthGate } from "@/app/providers/AuthGate";
import { HealthBanner } from "@/components/HealthBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/app/layout/AppLayout";
import StudyListPage from "@/features/studies/pages/StudyListPage";
import StudyDetailPage from "@/features/studies/pages/StudyDetailPage";
import SeriesDetailPage from "@/features/series/pages/SeriesDetailPage";
import InstanceDetailPage from "@/features/instances/pages/InstanceDetailPage";
import ViewerPage from "@/features/viewer/pages/ViewerPage";
import InvokeImageDisplayPage from "@/features/viewer/pages/InvokeImageDisplayPage";
import UploadPage from "@/features/upload/pages/UploadPage";
import RemoteSourcesPage from "@/features/servers/pages/RemoteSourcesPage";
import ActivityPage from "@/features/activity/pages/ActivityPage";
import AuditLogsPage from "@/features/audit/pages/AuditLogsPage";
import WorklistsPage from "@/features/worklists/pages/WorklistsPage";
import BrokerPage from "@/features/broker/pages/BrokerPage";
import { BrokerGate } from "@/features/broker/components/BrokerGate";
import SourcesPage from "@/features/broker/pages/SourcesPage";
import TargetsPage from "@/features/broker/pages/TargetsPage";
import RulesPage from "@/features/broker/pages/RulesPage";
import TransformsPage from "@/features/broker/pages/TransformsPage";
import BrokerSettingsPage from "@/features/broker/pages/BrokerSettingsPage";
import AuditPage from "@/features/broker/pages/AuditPage";
import SpoolPage from "@/features/broker/pages/SpoolPage";
import LocalWorklistPage from "@/features/broker/pages/LocalWorklistPage";
import StationsPage from "@/features/broker/pages/StationsPage";
import SettingsPage from "@/features/settings/pages/SettingsPage";
import NotFound from "./pages/NotFound";

const App = () => (
  <AppProviders>
    <AuthGate>
      <HealthBanner />
      <ErrorBoundary>
        <BrowserRouter basename="/oe3">
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/studies" replace />} />
              <Route path="studies" element={<StudyListPage />} />
              <Route path="studies/:studyId" element={<StudyDetailPage />} />
              <Route path="studies/:studyId/series/:seriesId" element={<SeriesDetailPage />} />
              <Route path="studies/:studyId/series/:seriesId/instances/:instanceId" element={<InstanceDetailPage />} />
              <Route path="upload" element={<UploadPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="worklists" element={<WorklistsPage />} />
              <Route path="broker" element={<BrokerGate><BrokerPage /></BrokerGate>} />
              <Route path="broker/sources" element={<BrokerGate><SourcesPage /></BrokerGate>} />
              <Route path="broker/targets" element={<BrokerGate><TargetsPage /></BrokerGate>} />
              <Route path="broker/rules" element={<BrokerGate><RulesPage /></BrokerGate>} />
              <Route path="broker/transforms" element={<BrokerGate><TransformsPage /></BrokerGate>} />
              <Route path="broker/settings" element={<BrokerGate><BrokerSettingsPage /></BrokerGate>} />
              <Route path="broker/audit" element={<BrokerGate><AuditPage /></BrokerGate>} />
              <Route path="broker/spool" element={<BrokerGate><SpoolPage /></BrokerGate>} />
              <Route path="broker/worklist" element={<BrokerGate><LocalWorklistPage /></BrokerGate>} />
              <Route path="broker/stations" element={<BrokerGate><StationsPage /></BrokerGate>} />
              <Route path="remote-sources" element={<RemoteSourcesPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="viewer/:studyId" element={<ViewerPage />} />
            {/* IHE Invoke Image Display (RAD-106) — what a RIS/KIS calls */}
            <Route path="IHEInvokeImageDisplay" element={<InvokeImageDisplayPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </AuthGate>
  </AppProviders>
);

export default App;
