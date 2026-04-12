import { useNavigate, useLocation } from 'react-router-dom';
import { X, BookOpen, FileText } from 'lucide-react';
import { useTabStore, type AppTab } from '@/store/tab-store';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useEffect } from 'react';

function getTabIcon(tab: AppTab) {
  if (!tab.closable) return <BookOpen className="h-3.5 w-3.5 shrink-0" />;
  return <FileText className="h-3.5 w-3.5 shrink-0" />;
}

/**
 * Extract the studyId from a path like /studies/:studyId or /studies/:studyId/series/...
 */
function extractStudyId(path: string): string | null {
  const match = path.match(/^\/studies\/([^/]+)/);
  return match ? match[1] : null;
}

export function TabBar() {
  const { tabs, activeTabId, activateTab, closeTab, openTab, updateTabPath } = useTabStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Sync current route to tabs
  useEffect(() => {
    const path = location.pathname;

    // Studies list — ensure pinned tab exists
    if (path === '/studies') {
      const pinned = tabs.find((t) => t.path === '/studies' && !t.closable);
      if (!pinned) {
        openTab({ path: '/studies', label: 'Studies', closable: false });
      } else if (pinned.id !== activeTabId) {
        activateTab(pinned.id);
      }
      return;
    }

    // Detail pages — group by studyId
    const studyId = extractStudyId(path);
    if (!studyId) return;

    const existingTab = tabs.find((t) => t.studyId === studyId);
    if (existingTab) {
      // Update the tab's path to the current drill-down location
      if (existingTab.path !== path) {
        updateTabPath(existingTab.id, path);
      }
      if (existingTab.id !== activeTabId) {
        activateTab(existingTab.id);
      }
    } else {
      // Open a new patient tab
      openTab({
        path,
        label: `Study ${studyId.slice(0, 8)}…`,
        closable: true,
        studyId,
      });
    }
  }, [location.pathname]);

  if (tabs.length === 0) return null;

  // Pinned (non-closable) tabs always render first
  const sortedTabs = [...tabs].sort((a, b) => {
    if (!a.closable && b.closable) return -1;
    if (a.closable && !b.closable) return 1;
    return 0;
  });

  const handleActivate = (tab: AppTab) => {
    activateTab(tab.id);
    navigate(tab.path);
  };

  const handleClose = (e: React.SyntheticEvent, tab: AppTab) => {
    e.stopPropagation();
    const wasActive = tab.id === activeTabId;
    closeTab(tab.id);

    if (wasActive) {
      const state = useTabStore.getState();
      if (state.activeTabId) {
        const newActive = state.tabs.find((t) => t.id === state.activeTabId);
        if (newActive) navigate(newActive.path);
      } else {
        navigate('/studies');
      }
    }
  };

  return (
    <div className="relative bg-[#ddd] dark:bg-muted shrink-0 pt-1">
      {/* Bottom border line that active tab will cover */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-black/20 dark:bg-white/20 z-0" />
      <ScrollArea className="w-full overflow-visible [&>div]:overflow-visible">
        <div className="relative flex items-stretch h-9" role="tablist" aria-label="Open pages">
          {sortedTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleActivate(tab)}
                className={cn(
                  'group relative flex items-center gap-1.5 px-3 text-xs font-medium transition-colors max-w-[220px] min-w-[100px]',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  isActive
                    ? 'bg-background text-foreground shadow-[0_1px_0_0_hsl(var(--background))] z-10 rounded-t-md border border-black/20 dark:border-white/20 border-b-transparent'
                    : 'bg-[#ddd] dark:bg-muted/70 text-muted-foreground/70 hover:bg-[#d0d0d0] dark:hover:bg-muted hover:text-muted-foreground border-b border-b-black/20 dark:border-b-white/20',
                )}
              >
                {getTabIcon(tab)}
                <span className="truncate">{tab.label}</span>
                {tab.closable && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Close ${tab.label}`}
                    onClick={(e) => handleClose(e, tab)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClose(e, tab);
                      }
                    }}
                    className={cn(
                      'ml-auto shrink-0 rounded p-0.5 hover:bg-muted-foreground/20 transition-opacity',
                      isActive ? 'opacity-70' : 'opacity-0 group-hover:opacity-70',
                    )}
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-1" />
      </ScrollArea>
    </div>
  );
}
