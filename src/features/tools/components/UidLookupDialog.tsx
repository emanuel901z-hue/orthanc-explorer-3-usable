import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, ArrowRight, AlertCircle, FileText, Layers, Image, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toolsApi, type LookupResult } from '@/api/tools';

interface UidLookupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  Patient: <User className="h-4 w-4" />,
  Study: <FileText className="h-4 w-4" />,
  Series: <Layers className="h-4 w-4" />,
  Instance: <Image className="h-4 w-4" />,
};

export function UidLookupDialog({ open, onOpenChange }: UidLookupDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<LookupResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    setError(null);
    setResults(null);

    try {
      const res = await toolsApi.lookup(trimmed);
      setResults(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setSearching(false);
    }
  };

  const handleNavigate = (r: LookupResult) => {
    onOpenChange(false);
    if (r.Type === 'Study') {
      navigate(`/studies/${r.ID}`);
    } else if (r.Type === 'Patient') {
      navigate(`/studies?patientId=${encodeURIComponent(r.ID)}`);
    } else {
      // For series or instance, navigate to studies or activity
      navigate(`/studies`);
    }
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setQuery('');
      setResults(null);
      setError(null);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            {t('lookup.title', { defaultValue: 'DICOM UID Lookup' })}
          </DialogTitle>
          <DialogDescription>
            {t('lookup.description', {
              defaultValue: 'Enter any DICOM StudyInstanceUID, SeriesInstanceUID, SOPInstanceUID or Orthanc UUID.',
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('lookup.placeholder', { defaultValue: '1.2.840.10008... or Orthanc UUID' })}
            className="flex-1 font-mono text-xs"
            autoFocus
          />
          <Button type="submit" disabled={searching || !query.trim()} className="gap-1.5 shrink-0">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t('lookup.search', { defaultValue: 'Lookup' })}
          </Button>
        </form>

        {/* Results */}
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-destructive bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {results !== null && (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-center py-6 text-xs text-muted-foreground">
                {t('lookup.noResults', { defaultValue: 'No DICOM resource matches this identifier.' })}
              </p>
            ) : (
              results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="text-muted-foreground shrink-0">{TYPE_ICONS[r.Type] || <FileText className="h-4 w-4" />}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] h-5">
                          {r.Type}
                        </Badge>
                        <code className="font-mono text-[11px] truncate">{r.ID}</code>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono truncate block mt-0.5">
                        {r.Path}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 shrink-0 ml-2"
                    onClick={() => handleNavigate(r)}
                  >
                    <span>{t('lookup.open', { defaultValue: 'Open' })}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
