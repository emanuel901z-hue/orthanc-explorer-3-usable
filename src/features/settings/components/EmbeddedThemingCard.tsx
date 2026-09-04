import { useState } from 'react';
import { Palette, Type, RectangleHorizontal, LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useUiStore, FONT_PRESETS, RADIUS_PRESETS } from '@/store/ui-store';

export default function EmbeddedThemingCard() {
  const { t } = useTranslation();
  const {
    primaryColor,
    accentColor,
    fontPreset,
    customFontStack,
    borderRadius,
    compactMode,
    hideSidebar,
    hideHeader,
    setPrimaryColor,
    setAccentColor,
    setFontPreset,
    setCustomFontStack,
    setBorderRadius,
    setCompactMode,
    setHideSidebar,
    setHideHeader,
    resetTheming,
  } = useUiStore();

  const [draftAppName, setDraftAppName] = useState(useUiStore.getState().appName);

  const handleSave = () => {
    useUiStore.getState().setAppName(draftAppName);
    toast.success(t('settings.brandingSaved'));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{t('theming.title')}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {t('theming.subtitle')}
            </p>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            SMART
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Colors */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Palette className="h-4 w-4 text-muted-foreground" />
            {t('theming.colors')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary-color" className="text-sm">
                {t('theming.primaryColor')}
              </Label>
              <div className="flex gap-2">
                <div className="relative">
                  <input
                    type="color"
                    id="primary-color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-12 rounded-md border border-input cursor-pointer bg-transparent p-1"
                  />
                </div>
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#2563EB"
                  className="font-mono text-sm flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('theming.primaryColorHelp')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accent-color" className="text-sm">
                {t('theming.accentColor')}
              </Label>
              <div className="flex gap-2">
                <div className="relative">
                  <input
                    type="color"
                    id="accent-color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 w-12 rounded-md border border-input cursor-pointer bg-transparent p-1"
                  />
                </div>
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="#0D9488"
                  className="font-mono text-sm flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('theming.accentColorHelp')}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Typography */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Type className="h-4 w-4 text-muted-foreground" />
            {t('theming.typography')}
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-sm">{t('theming.fontFamily')}</Label>
              <Select value={fontPreset} onValueChange={setFontPreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_PRESETS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fontPreset !== 'custom' && (
                <p className="text-xs text-muted-foreground font-mono">
                  {FONT_PRESETS.find((f) => f.value === fontPreset)?.stack}
                </p>
              )}
            </div>
            {fontPreset === 'custom' && (
              <div className="space-y-2">
                <Label className="text-sm">{t('theming.customFontStack')}</Label>
                <Input
                  value={customFontStack}
                  onChange={(e) => setCustomFontStack(e.target.value)}
                  placeholder='"Custom Font", "Fallback Font", sans-serif'
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {t('theming.customFontStackHelp')}
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Shape & Density */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <RectangleHorizontal className="h-4 w-4 text-muted-foreground" />
            {t('theming.shapeDensity')}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">{t('theming.borderRadius')}</Label>
              <Select value={borderRadius} onValueChange={setBorderRadius}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RADIUS_PRESETS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('theming.borderRadiusHelp')}
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t('theming.compactMode')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('theming.compactModeHelp')}
                  </p>
                </div>
                <Switch checked={compactMode} onCheckedChange={setCompactMode} />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Embedded Layout */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            {t('theming.embeddedLayout')}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('theming.embeddedLayoutHelp')}
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">{t('theming.hideSidebar')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('theming.hideSidebarHelp')}
                </p>
              </div>
              <Switch checked={hideSidebar} onCheckedChange={setHideSidebar} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">{t('theming.hideHeader')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('theming.hideHeaderHelp')}
                </p>
              </div>
              <Switch checked={hideHeader} onCheckedChange={setHideHeader} />
            </div>
          </div>
        </div>

        <Separator />

        {/* Preview + Save */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-md border"
              style={{ backgroundColor: primaryColor }}
              aria-label={t('theming.primaryColor')}
            />
            <div
              className="h-8 w-8 rounded-md border"
              style={{ backgroundColor: accentColor, borderRadius: borderRadius }}
              aria-label={t('theming.accentColor')}
            />
            <span className="text-xs text-muted-foreground">{t('theming.livePreview')}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetTheming();
                setDraftAppName(useUiStore.getState().appName);
                toast.info(t('theming.reset'));
              }}
            >
              {t('theming.reset')}
            </Button>
            <Button size="sm" onClick={handleSave}>
              {t('theming.saveTheming')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
