import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Upload,
  Globe,
  Settings,
  Activity as ActivityIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Info,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { AboutDialog } from './AboutDialog';

export function AppSidebar() {
  const { toggleSidebar, state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const [aboutOpen, setAboutOpen] = useState(false);
  const { t } = useTranslation();

  const navItems = [
    { title: t('nav.studies'), url: '/studies', icon: BookOpen },
    { title: t('nav.upload'), url: '/upload', icon: Upload },
    { title: t('nav.activity'), url: '/activity', icon: ActivityIcon },
    { title: t('nav.remoteSources'), url: '/remote-sources', icon: Globe },
    { title: t('nav.settings'), url: '/settings', icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon">
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
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="System Status">
                  <div className="flex items-center gap-2 text-sidebar-muted-foreground cursor-default">
                    <ActivityIcon className="h-4 w-4" />
                    <span className="text-xs">{t('nav.demoMode')}</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
              v0.1.0 · © 2026 OrthancExplorer
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
