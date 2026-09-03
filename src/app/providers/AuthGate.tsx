/**
 * Auth gate — shows a loading spinner, an auth-required screen, or children.
 * Must be rendered inside AuthProvider.
 */
import { type ReactNode } from 'react';
import { ShieldAlert, Loader2, LockKeyhole } from 'lucide-react';
import { useAuth } from './auth-context';

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, authError } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Authentifizierung wird geprueft...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <h1 className="text-xl font-semibold">Zugriff verweigert</h1>
          <p className="text-sm text-muted-foreground">{authError}</p>
          <a
            href="/admin?tab=pacs"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Zurueck zum Admin-Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
          <LockKeyhole className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Anmeldung erforderlich</h1>
          <p className="text-sm text-muted-foreground">
            Orthanc Explorer 3 erfordert eine System-Administrator-Anmeldung.
            Bitte oeffnen Sie OE3 ueber das Admin-Dashboard (PACS-Tab).
          </p>
          <a
            href="/admin?tab=pacs"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Zum Admin-Dashboard
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
