import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Server, Radio, Globe, Eye, Sliders, Activity, Sun, Moon, Monitor, Check, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useUiStore } from '@/store/ui-store';
import { DicomModality, DicomWebServer } from '@/shared/types';
import AddModalityDialog from '@/features/settings/components/AddModalityDialog';
import AddServerDialog from '@/features/settings/components/AddServerDialog';
import EmbeddedThemingCard from '@/features/settings/components/EmbeddedThemingCard';
import SystemInfoTab from '@/features/settings/components/SystemInfoTab';
import ModalitiesTab from '@/features/settings/components/ModalitiesTab';
import DicomWebTab from '@/features/settings/components/DicomWebTab';
import ViewerTab from '@/features/settings/components/ViewerTab';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { theme, setTheme } = useUiStore();
  const { t, i18n } = useTranslation();
  const [addModalityOpen, setAddModalityOpen] = useState(false);
  const [editModality, setEditModality] = useState<DicomModality | null>(null);
  const [addServerOpen, setAddServerOpen] = useState(false);
  const [editServer, setEditServer] = useState<DicomWebServer | null>(null);

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    toast.success(`Language changed to ${lang?.name}`, { description: lang?.nativeName });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Tabs defaultValue="system" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="system" className="gap-1.5"><Server className="h-3.5 w-3.5" /> {t('settings.system')}</TabsTrigger>
          <TabsTrigger value="modalities" className="gap-1.5"><Radio className="h-3.5 w-3.5" /> {t('settings.modalities')}</TabsTrigger>
          <TabsTrigger value="dicomweb" className="gap-1.5"><Globe className="h-3.5 w-3.5" /> {t('settings.dicomweb')}</TabsTrigger>
          <TabsTrigger value="viewer" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> {t('settings.viewer')}</TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5"><Sliders className="h-3.5 w-3.5" /> {t('settings.preferences')}</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-4">
          <SystemInfoTab />
        </TabsContent>

        <TabsContent value="modalities" className="space-y-4">
          <ModalitiesTab
            onAddClick={() => setAddModalityOpen(true)}
            onEditClick={(m) => setEditModality(m)}
          />
        </TabsContent>

        <TabsContent value="dicomweb" className="space-y-4">
          <DicomWebTab
            onAddClick={() => setAddServerOpen(true)}
            onEditClick={(s) => setEditServer(s)}
          />
        </TabsContent>

        <TabsContent value="viewer" className="space-y-4">
          <ViewerTab />
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <EmbeddedThemingCard />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('settings.customization')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">{t('settings.customizationDesc')}</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="app-name" className="text-sm font-medium">{t('settings.appName')}</Label>
                  <Input id="app-name" placeholder={t('settings.appNamePlaceholder')} defaultValue="Orthanc Explorer 3" />
                  <p className="text-xs text-muted-foreground">{t('settings.appNameDesc')}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('settings.appIcon')}</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50">
                      <Activity className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-1.5">
                      <Button type="button" variant="outline" size="sm">{t('settings.uploadIcon')}</Button>
                      <p className="text-xs text-muted-foreground">{t('settings.appIconDesc')}</p>
                    </div>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button size="sm" onClick={() => toast.success(t('settings.brandingSaved'))}>{t('settings.saveBranding')}</Button>
              </div>
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Languages className="h-4 w-4" />
                {t('settings.language')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t('settings.languageDesc')}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isActive = i18n.language === lang.code || i18n.language?.startsWith(lang.code + '-');
                  return (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className={`relative flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 transition-all text-left ${
                        isActive
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border hover:border-muted-foreground/40 hover:bg-muted/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{lang.nativeName}</p>
                        <p className="text-xs text-muted-foreground">{lang.name}</p>
                      </div>
                      {isActive && (
                        <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('settings.appearance')}</CardTitle>
              <p className="text-xs text-muted-foreground">{t('settings.appearanceDesc')}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: 'light' as const, label: t('settings.themeLight'), icon: Sun, bg: 'bg-white', sidebar: 'bg-slate-100', header: 'bg-blue-600', text: 'bg-slate-300', textSm: 'bg-slate-200' },
                  { value: 'dark' as const, label: t('settings.themeDark'), icon: Moon, bg: 'bg-slate-900', sidebar: 'bg-slate-800', header: 'bg-blue-700', text: 'bg-slate-600', textSm: 'bg-slate-700' },
                  { value: 'system' as const, label: t('settings.themeSystem'), icon: Monitor, bg: 'bg-gradient-to-r from-white to-slate-900', sidebar: 'bg-gradient-to-r from-slate-100 to-slate-800', header: 'bg-blue-600', text: 'bg-slate-400', textSm: 'bg-slate-300' },
                ]).map((th) => {
                  const isActive = theme === th.value;
                  return (
                    <button
                      key={th.value}
                      onClick={() => setTheme(th.value)}
                      className={`relative rounded-lg border-2 p-1.5 transition-all text-left ${
                        isActive
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-muted-foreground/40'
                      }`}
                    >
                      <div className={`rounded-md ${th.bg} overflow-hidden aspect-[4/3] border border-black/10`}>
                        <div className={`${th.header} h-[10%]`} />
                        <div className="flex h-[90%]">
                          <div className={`${th.sidebar} w-[22%] p-1 space-y-0.5`}>
                            <div className={`${th.text} h-1 w-full rounded-full`} />
                            <div className={`${th.textSm} h-1 w-3/4 rounded-full`} />
                            <div className={`${th.textSm} h-1 w-full rounded-full`} />
                          </div>
                          <div className="flex-1 p-1.5 space-y-1">
                            <div className={`${th.text} h-1.5 w-2/3 rounded-full`} />
                            <div className={`${th.textSm} h-1 w-full rounded-full`} />
                            <div className={`${th.textSm} h-1 w-5/6 rounded-full`} />
                            <div className={`${th.textSm} h-1 w-full rounded-full`} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-1.5 mt-2 pb-0.5">
                        <th.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{th.label}</span>
                      </div>
                      {isActive && (
                        <div className="absolute top-2.5 right-2.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddModalityDialog
        open={addModalityOpen || !!editModality}
        onOpenChange={(open) => {
          if (!open) { setAddModalityOpen(false); setEditModality(null); }
        }}
        editModality={editModality}
        onSave={(values) => {
          toast.success(editModality ? `Modality "${values.name}" updated` : `Modality "${values.name}" added`, { description: `${values.aet} @ ${values.host}:${values.port}` });
          setEditModality(null);
        }}
      />

      <AddServerDialog
        open={addServerOpen || !!editServer}
        onOpenChange={(open) => {
          if (!open) { setAddServerOpen(false); setEditServer(null); }
        }}
        editServer={editServer}
        onSave={(values) => {
          toast.success(editServer ? `Server "${values.name}" updated` : `Server "${values.name}" added`, { description: values.url });
          setEditServer(null);
        }}
      />
    </div>
  );
}
