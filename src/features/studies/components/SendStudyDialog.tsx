import { useState } from 'react';
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

interface StudyInfo {
  id: string;
  patientName: string;
  studyDescription?: string;
}

interface SendStudyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studies: StudyInfo[];
}

type SendProtocol = 'stow-rs' | 'c-store';

export default function SendStudyDialog({ open, onOpenChange, studies }: SendStudyDialogProps) {
  const [protocol, setProtocol] = useState<SendProtocol>('stow-rs');
  const [selectedTarget, setSelectedTarget] = useState('');

  const { data: modalityNames = [], isLoading: modalitiesLoading } = useModalities();
  const { data: serverNames = [], isLoading: serversLoading } = useDicomWebServers();

  const sendMutation = useMutation({
    mutationFn: async ({ studyId, target }: { studyId: string; target: string }) =>
      sendStudyAction(studyId, target),
    onSuccess: () => {
      toast.success('Study sent successfully');
      handleClose();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to send study';
      toast.error(message);
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setSelectedTarget('');
      setProtocol('stow-rs');
    }, 200);
  };

  const handleProtocolChange = (value: string) => {
    setProtocol(value as SendProtocol);
    setSelectedTarget('');
  };

  const handleSend = () => {
    if (!selectedTarget) return;
    if (protocol === 'c-store') {
      studies.forEach((study) => {
        sendMutation.mutate({ studyId: study.id, target: selectedTarget });
      });
    }
    // STOW-RS send is not yet implemented in the backend action layer;
    // the tab displays live servers but send is disabled until the action exists.
  };

  const isSending = sendMutation.isPending;

  const targets = protocol === 'stow-rs' ? serverNames : modalityNames;
  const hasTargets = targets.length > 0;
  const isLoading = protocol === 'stow-rs' ? serversLoading : modalitiesLoading;

  // STOW-RS send is disabled pending a dedicated action
  const canSend = !isSending && !!selectedTarget && hasTargets && protocol === 'c-store';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send {studies.length === 1 ? 'Study' : `${studies.length} Studies`}
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

            <TabsContent value="stow-rs" className="mt-3">
              {isLoading ? (
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
              {isLoading ? (
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
