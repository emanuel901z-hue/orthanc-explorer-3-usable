import { useState } from 'react';
import { Palette, Type, RectangleHorizontal, Minimize2, LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const FONT_PRESETS = [
  { value: 'inter', label: 'Inter (Default)', stack: 'Inter, system-ui, sans-serif' },
  { value: 'system', label: 'System Default', stack: 'system-ui, -apple-system, sans-serif' },
  { value: 'segoe', label: 'Segoe UI (Windows)', stack: '"Segoe UI", Tahoma, Geneva, sans-serif' },
  { value: 'sf-pro', label: 'SF Pro (Apple)', stack: '-apple-system, BlinkMacSystemFont, sans-serif' },
  { value: 'roboto', label: 'Roboto (Android/Material)', stack: 'Roboto, "Helvetica Neue", sans-serif' },
  { value: 'noto', label: 'Noto Sans (Cross-platform)', stack: '"Noto Sans", sans-serif' },
  { value: 'custom', label: 'Custom…', stack: '' },
];

const RADIUS_PRESETS = [
  { value: '0', label: 'None (0px)' },
  { value: '0.25rem', label: 'Small (4px)' },
  { value: '0.375rem', label: 'Medium (6px)' },
  { value: '0.5rem', label: 'Default (8px)' },
  { value: '0.75rem', label: 'Large (12px)' },
  { value: '1rem', label: 'Extra Large (16px)' },
];

export default function EmbeddedThemingCard() {
  const [primaryColor, setPrimaryColor] = useState('#2563EB');
  const [accentColor, setAccentColor] = useState('#0D9488');
  const [fontPreset, setFontPreset] = useState('inter');
  const [customFontStack, setCustomFontStack] = useState('');
  const [borderRadius, setBorderRadius] = useState('0.5rem');
  const [compactMode, setCompactMode] = useState(false);
  const [hideSidebar, setHideSidebar] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Embedded Theming (SMART on FHIR)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Adjust colors, typography, and layout to match the host EHR application when running in embedded mode.
            </p>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">SMART</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Colors */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Palette className="h-4 w-4 text-muted-foreground" />
            Colors
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary-color" className="text-sm">Primary Color</Label>
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
              <p className="text-xs text-muted-foreground">Header bar, buttons, and active states</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accent-color" className="text-sm">Accent Color</Label>
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
              <p className="text-xs text-muted-foreground">Links, badges, and secondary highlights</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Typography */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Type className="h-4 w-4 text-muted-foreground" />
            Typography
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-sm">Font Family</Label>
              <Select value={fontPreset} onValueChange={setFontPreset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_PRESETS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
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
                <Label className="text-sm">Custom Font Stack</Label>
                <Input
                  value={customFontStack}
                  onChange={(e) => setCustomFontStack(e.target.value)}
                  placeholder='"Custom Font", "Fallback Font", sans-serif'
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Ensure the font is loaded by the host EHR or included via a CSS import.
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
            Shape &amp; Density
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Border Radius</Label>
              <Select value={borderRadius} onValueChange={setBorderRadius}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RADIUS_PRESETS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Match the EHR's corner style for a seamless look.</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Compact Mode</p>
                  <p className="text-xs text-muted-foreground">Reduce padding and spacing for tighter layouts</p>
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
            Embedded Layout
          </div>
          <p className="text-xs text-muted-foreground">
            When launched inside an EHR iframe, hide redundant chrome to avoid duplicate navigation.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Hide Sidebar</p>
                <p className="text-xs text-muted-foreground">Remove the left navigation when EHR provides its own</p>
              </div>
              <Switch checked={hideSidebar} onCheckedChange={setHideSidebar} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Hide Header Bar</p>
                <p className="text-xs text-muted-foreground">Remove the top header when embedded in an EHR frame</p>
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
              aria-label="Primary color preview"
            />
            <div
              className="h-8 w-8 rounded-md border"
              style={{ backgroundColor: accentColor, borderRadius: borderRadius }}
              aria-label="Accent color preview"
            />
            <span className="text-xs text-muted-foreground">Live preview</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setPrimaryColor('#2563EB');
              setAccentColor('#0D9488');
              setFontPreset('inter');
              setCustomFontStack('');
              setBorderRadius('0.5rem');
              setCompactMode(false);
              setHideSidebar(false);
              setHideHeader(false);
              toast.info('Embedded theming reset to defaults');
            }}>
              Reset
            </Button>
            <Button size="sm" onClick={() => toast.success('Embedded theming settings saved')}>
              Save Theming
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
