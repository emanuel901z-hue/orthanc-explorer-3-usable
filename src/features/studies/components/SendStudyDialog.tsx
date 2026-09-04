import { useCallback, useState } from 'react';
import { Send, Globe, Radio } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useModalities } from '@/features/settings/hooks/use-modalities';
import { useDicomWebServers } from '@/features/settings/hooks/use-dicom-web-servers';
import { sendStudyAction } from '@/actions/sendStudy';
import { sendSeriesAction } from '@/actions/sendSeries';
import { sendInstanceAction } from '@/actions/sendInstance';

interface ResourceInfo {
  id: string;
  patientName: string;
  studyDescription?: string;
}

interface SendStudyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studies: ResourceInfo[];
  /** Resource level: 'study' (default), 'series', or 'instance'. Determines which send action is used. */
  level?: 'study' | 'series' | 'instance';
}

type SendProtocol = 'stow-rs' | 'c-store';

export default function SendStudyDialog({ open, onOpenChange, studies, level = 'study' }: SendStudyDialogProps) {
  const [protocol, setProtocol] = useState<SendProtocol>('stow-rs');
  const [selectedTarget, setSelectedTarget] = useState('');

  const { data: modalityNames = [], isLoading: modalitiesLoading } = useModalities();
  const { data: serverNames = [], isLoading: serversLoading } = useDicomWebServers();

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(() => {
      setSelectedTarget('');
      setProtocol('stow-rs');
    }, 200);
  }, [onOpenChange]);

  const sendMutation = useMutation({
    mutationFn: async ({ resourceIds, target }: { resourceIds: string[]; target: string }) => {
      if (level === 'series') {
        await Promise.all(resourceIds.map((id) => sendSeriesAction(id, target)));
      } else if (level === 'instance') {
        await Promise.all(resourceIds.map((id) => sendInstanceAction(id, target)));
      } else {
        await Promise.all(resourceIds.map((id) => sendStudyAction(id, target)));
      }
    },
    onSuccess: () => {
      toast.success(`${level.charAt(0).toUpperCase() + level.slice(1)} sent successfully`);
      handleClose();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : `Failed to send ${level}`;
      toast.error(message);
    },
  });

  const handleProtocolChange = (value: string) => {
    setProtocol(value as SendProtocol);
    setSelectedTarget('');
  };

  const handleSend = () => {
    if (!selectedTarget) return;
    if (protocol === 'c-store') {
      sendMutation.mutate({ resourceIds: studies.map((s) => s.id), target: selectedTarget });
    }
  };

  const isSending = sendMutation.isPending;
  const canSend = !isSending && !!selectedTarget && protocol === 'c-store';
  const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);
  const pluralLabel = studies.length === 1 ? levelLabel : `${studies.length} ${levelLabel}s`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send {pluralLabel}
          </DialogTitle>
          <DialogDescription>
            Choose a protocol and destination. Progress will be tracked in the Job Manager.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Study summary */}
          <div className="rounded-lg border p-3 space-y-1.5 max-h-32 overflow-y-auto">
            {studies.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="font-medium truncate">{s.patientName}</span>
                <span className="text-muted-foreground text-xs truncate ml-2">{s.studyDescription || 'No description'}</span>
              </div>
            ))}
          </div>

          {/* Protocol tabs */}
          <Tabs value={protocol} onValueChange={handleProtocolChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stow-rs" className="gap-1.5">
                <Globe className="h-3.5 w-3.5" /> STOW-RS
              </TabsTrigger>
              <TabsTrigger value="c-store" className="gap-1.5">
                <Radio className="h-3.5 w-3.5" /> C-STORE
              </TabsTrigger>
            </TabsList>

            {/* Fix 2: Use each tab's own loading flag directly — no shared isLoading derived variable */}
            <TabsContent value="stow-rs" className="mt-3">
              {serversLoading ? (
                <LoadingState />
              ) : serverNames.length === 0 ? (
                <EmptyState
                  icon={<Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />}
                  message="No DICOMweb servers with STOW-RS support configured."
                  hint="Add a server in Settings → DICOMweb Servers."
                />
              ) : (
                <RadioGroup value={selectedTarget} onValueChange={setSelectedTarget} className="space-y-2">
                  {serverNames.map((name) => (
                    <label
                      key={name}
                      htmlFor={`target-stow-${name}`}
                      className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <RadioGroupItem value={name} id={`target-stow-${name}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{name}</span>
                          <Badge variant="outline" className="text-xs py-0 h-5">STOW-RS</Badge>
                        </div>
                      </div>
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    </label>
                  ))}
                </RadioGroup>
              )}
            </TabsContent>

            <TabsContent value="c-store" className="mt-3">
              {modalitiesLoading ? (
                <LoadingState />
              ) : modalityNames.length === 0 ? (
                <EmptyState
                  icon={<Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />}
                  message="No DICOM modalities configured."
                  hint="Add a modality in Settings → Modalities."
                />
              ) : (
                <RadioGroup value={selectedTarget} onValueChange={setSelectedTarget} className="space-y-2">
                  {modalityNames.map((name) => (
                    <label
                      key={name}
                      htmlFor={`target-cstore-${name}`}
                      className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <RadioGroupItem value={name} id={`target-cstore-${name}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{name}</span>
                        </div>
                      </div>
                      <Radio className="h-4 w-4 text-muted-foreground shrink-0" />
                    </label>
                  ))}
                </RadioGroup>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>Cancel</Button>
          <Button onClick={handleSend} disabled={!canSend} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            {isSending ? 'Sending…' : `Send via ${protocol === 'stow-rs' ? 'STOW-RS' : 'C-STORE'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Helpers ──────────────────────────────────────────── */

function EmptyState({ icon, message, hint }: { icon: React.ReactNode; message: string; hint: string }) {
  return (
    <div className="text-center py-6 text-muted-foreground text-sm">
      {icon}
      <p>{message}</p>
      <p className="text-xs mt-1">{hint}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="text-center py-6 text-muted-foreground text-sm animate-pulse">
      Loading…
    </div>
  );
}
