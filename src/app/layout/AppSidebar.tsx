import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Upload,
  Globe,
  Settings,
  Activity as ActivityIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Info,
  Shield,
  ClipboardList,
  RadioTower,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { brokerApi } from '@/api/broker';
import { AboutDialog } from './AboutDialog';
import { useUiStore } from '@/store/ui-store';
import { useFeature } from '@/config/features';
import { getConfig } from '@/config/runtime';
import { APP_VERSION } from '@/config/version';

export function AppSidebar() {
  const { toggleSidebar, state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const [aboutOpen, setAboutOpen] = useState(false);
  const { t } = useTranslation();
  const { appName, logoUrl } = useUiStore();
  const brokerEnabled = useFeature('mwlBroker') && Boolean(getConfig().brokerUrl);

  // Configuration health for the sidebar badge — refreshed lazily (60 s),
  // the dashboard polls the same key every 30 s while it is open.
  const healthQuery = useQuery({
    queryKey: ['broker', 'health'],
    queryFn: () => brokerApi.health.config(),
    enabled: brokerEnabled,
    staleTime: 60_000,
  });
  const health = healthQuery.data?.summary;
  const healthBadge = health && health.error > 0
    ? { count: health.error, variant: 'destructive' as const, label: t('broker.healthErrors', { count: health.error }) }
    : health && health.warning > 0
      ? { count: health.warning, variant: 'secondary' as const, label: t('broker.healthWarnings', { count: health.warning }) }
      : null;

  type NavItem = {
    title: string;
    url: string;
    icon: typeof BookOpen;
    children?: { title: string; url: string }[];
  };

  const navItems: NavItem[] = [
    { title: t('nav.studies'), url: '/studies', icon: BookOpen },
    { title: t('nav.upload'), url: '/upload', icon: Upload },
    { title: t('nav.activity'), url: '/activity', icon: ActivityIcon },
    { title: t('nav.auditLogs', { defaultValue: 'Audit Logs' }), url: '/audit-logs', icon: Shield },
    { title: t('nav.worklists', { defaultValue: 'Worklists' }), url: '/worklists', icon: ClipboardList },
    ...(brokerEnabled
      ? [{
          title: t('nav.broker', { defaultValue: 'MWL Broker' }),
          url: '/broker',
          icon: RadioTower,
          children: [
            { title: t('broker.sourcesTitle'), url: '/broker/sources' },
            { title: t('broker.targetsTitle'), url: '/broker/targets' },
            { title: t('broker.rulesTitle'), url: '/broker/rules' },
            { title: t('broker.transformsTitle'), url: '/broker/transforms' },
            { title: t('broker.settingsTitle'), url: '/broker/settings' },
            { title: t('broker.spoolPageTitle'), url: '/broker/spool' },
            { title: t('broker.localTitle'), url: '/broker/worklist' },
            { title: t('broker.stationTitle'), url: '/broker/stations' },
            { title: t('broker.auditTitle'), url: '/broker/audit' },
          ],
        }]
      : []),
    { title: t('nav.remoteSources'), url: '/remote-sources', icon: Globe },
    { title: t('nav.settings'), url: '/settings', icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-2">
        <div className="flex items-center gap-2">
          <img
            src={logoUrl}
            alt={appName}
            className="h-8 w-8 shrink-0 rounded object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {!isCollapsed && (
            <span className="font-semibold text-sm truncate">{appName}</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.navigation')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      onClick={() => {
                        // Close the mobile sheet after navigation — otherwise the
                        // menu stays open and covers the content on small screens.
                        if (isMobile) setOpenMobile(false);
                      }}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                  {item.url === '/broker' && healthBadge && (
                    <SidebarMenuBadge
                      className={healthBadge.variant === 'destructive' ? 'text-destructive' : 'text-amber-600'}
                      title={healthBadge.label}
                      aria-label={healthBadge.label}
                    >
                      {healthBadge.count}
                    </SidebarMenuBadge>
                  )}
                  {item.children && (
                    <SidebarMenuSub>
                      {item.children.map((child) => (
                        <SidebarMenuSubItem key={child.url}>
                          <SidebarMenuSubButton asChild>
                            <NavLink
                              to={child.url}
                              className="hover:bg-sidebar-accent"
                              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              onClick={() => {
                                if (isMobile) setOpenMobile(false);
                              }}
                            >
                              <span>{child.title}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={isCollapsed ? t('nav.expand') : t('nav.collapse')}
                  onClick={toggleSidebar}
                  className="hover:bg-sidebar-accent cursor-pointer"
                >
                  {isCollapsed
                    ? <PanelLeftOpen className="h-4 w-4" />
                    : <PanelLeftClose className="h-4 w-4" />
                  }
                  <span>{isCollapsed ? t('nav.expand') : t('nav.collapse')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <button
          onClick={() => setAboutOpen(true)}
          className="flex items-center gap-2 px-2 py-1 text-sidebar-muted-foreground hover:text-sidebar-foreground transition-colors w-full text-left cursor-pointer"
        >
          <Info className="h-3 w-3 shrink-0" />
          {!isCollapsed && (
            <span className="text-[10px] leading-tight">
              v{APP_VERSION} · © 2026 OE3 Usable Fork
              <br />
              MIT License
            </span>
          )}
        </button>
      </SidebarFooter>
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </Sidebar>
  );
}
