import { Outlet, useLocation } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { AppSidebar } from './AppSidebar';
import { TabBar } from './TabBar';
import { JobStatusBar } from './JobStatusBar';
import { UserBadge } from './UserBadge';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useTabStore } from '@/store/tab-store';
import { useEffect } from 'react';
import { useKeyboardShortcuts } from '@/shared/hooks/use-keyboard-shortcuts';
import { KeyboardShortcutsDialog } from '@/shared/components/KeyboardShortcutsDialog';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function AppLayout() {
  const location = useLocation();
  const { tabs, openTab } = useTabStore();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const toggleShortcuts = useCallback(() => setShortcutsOpen((o) => !o), []);
  useKeyboardShortcuts(toggleShortcuts);

  // Ensure the Studies tab always exists on mount
  useEffect(() => {
    const hasStudies = tabs.some((t) => t.path === '/studies');
    if (!hasStudies) {
      openTab({ path: '/studies', label: 'Studies', icon: 'book-open', closable: false });
    }
  }, []);

  // Show tab bar only on tab-eligible routes (studies list + detail pages)
  const showTabBar = /^\/studies(\/|$)/.test(location.pathname);

  return (
    <SidebarProvider>
        <div className="h-screen flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <header className="h-14 border-b flex items-center px-4 gap-3 bg-primary shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded bg-primary-foreground flex items-center justify-center">
                <span className="text-primary font-bold text-sm">O3</span>
              </div>
              <h1 className="font-semibold text-sm text-primary-foreground hidden sm:block">Orthanc Explorer 3</h1>
            </div>
            <div className="flex-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                  onClick={toggleShortcuts}
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
            </Tooltip>
            <UserBadge />
          </header>
          {showTabBar && <TabBar />}
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
          <JobStatusBar />
        </div>
      </div>
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </SidebarProvider>
  );
}
