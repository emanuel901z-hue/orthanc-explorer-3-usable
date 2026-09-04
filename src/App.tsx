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
import UploadPage from "@/features/upload/pages/UploadPage";
import RemoteSourcesPage from "@/features/servers/pages/RemoteSourcesPage";
import ActivityPage from "@/features/activity/pages/ActivityPage";
import AuditLogsPage from "@/features/audit/pages/AuditLogsPage";
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
              <Route path="remote-sources" element={<RemoteSourcesPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="viewer/:studyId" element={<ViewerPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </AuthGate>
  </AppProviders>
);

export default App;
