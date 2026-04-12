import { useState } from 'react';
import { Send, Globe, Radio } from 'lucide-react';
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
import { generateDemoDicomWebServers, generateDemoModalities } from '@/shared/api/mock/demo-data-generator';
import { useJobStore } from '@/store/job-store';

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

  const dicomWebServers = generateDemoDicomWebServers().filter((s) => s.hasStowSupport);
  const modalities = generateDemoModalities();

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

    const jobStore = useJobStore.getState();

    if (protocol === 'stow-rs') {
      const server = dicomWebServers.find((s) => s.id === selectedTarget);
      if (!server) return;

      studies.forEach((study, i) => {
        const jobId = `send-stow-${Date.now()}-${i}`;
        jobStore.addJob({
          id: jobId,
          type: 'send',
          label: `${study.patientName} → ${server.name}`,
          description: study.studyDescription || 'STOW-RS',
          progress: 0,
          status: 'pending',
          totalItems: 1,
          completedItems: 0,
        });
        simulateSendProgress(jobStore, jobId, i, 'STOW-RS');
      });
    } else {
      const modality = modalities.find((m) => m.id === selectedTarget);
      if (!modality) return;

      studies.forEach((study, i) => {
        const jobId = `send-cstore-${Date.now()}-${i}`;
        jobStore.addJob({
          id: jobId,
          type: 'send',
          label: `${study.patientName} → ${modality.name}`,
          description: `C-STORE to ${modality.aet}`,
          progress: 0,
          status: 'pending',
          totalItems: 1,
          completedItems: 0,
        });
        simulateSendProgress(jobStore, jobId, i, 'C-STORE');
      });
    }

    handleClose();
  };

  const hasTargets = protocol === 'stow-rs' ? dicomWebServers.length > 0 : modalities.length > 0;

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
              {dicomWebServers.length === 0 ? (
                <EmptyState
                  icon={<Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />}
                  message="No DICOMweb servers with STOW-RS support configured."
                  hint="Add a server in Settings → DICOMweb Servers."
                />
              ) : (
                <RadioGroup value={selectedTarget} onValueChange={setSelectedTarget} className="space-y-2">
                  {dicomWebServers.map((server) => (
                    <label
                      key={server.id}
                      htmlFor={`target-${server.id}`}
                      className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <RadioGroupItem value={server.id} id={`target-${server.id}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{server.name}</span>
                          <Badge variant="outline" className="text-xs py-0 h-5">
                            {server.authType === 'none' ? 'No Auth' : server.authType === 'basic' ? 'Basic' : 'Bearer'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">{server.url}</p>
                      </div>
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    </label>
                  ))}
                </RadioGroup>
              )}
            </TabsContent>

            <TabsContent value="c-store" className="mt-3">
              {modalities.length === 0 ? (
                <EmptyState
                  icon={<Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />}
                  message="No DICOM modalities configured."
                  hint="Add a modality in Settings → Modalities."
                />
              ) : (
                <RadioGroup value={selectedTarget} onValueChange={setSelectedTarget} className="space-y-2">
                  {modalities.map((modality) => (
                    <label
                      key={modality.id}
                      htmlFor={`target-${modality.id}`}
                      className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <RadioGroupItem value={modality.id} id={`target-${modality.id}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{modality.name}</span>
                          <Badge variant="outline" className="text-xs py-0 h-5">{modality.aet}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {modality.host}:{modality.port}
                        </p>
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
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={!selectedTarget || !hasTargets} className="gap-1.5">
            <Send className="h-3.5 w-3.5" /> Send via {protocol === 'stow-rs' ? 'STOW-RS' : 'C-STORE'}
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

function simulateSendProgress(
  jobStore: ReturnType<typeof useJobStore.getState>,
  jobId: string,
  index: number,
  protocol: string,
) {
  setTimeout(() => {
    jobStore.updateJob(jobId, { status: 'running' });
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 20 + 5;
      if (p >= 100) {
        clearInterval(interval);
        const success = Math.random() > 0.1;
        jobStore.updateJob(jobId, {
          progress: 100,
          status: success ? 'complete' : 'error',
          completedItems: success ? 1 : 0,
          error: success ? undefined : `${protocol} transfer failed — connection refused`,
        });
      } else {
        jobStore.updateJob(jobId, { progress: p });
      }
    }, 300);
  }, 300 * (index + 1));
}
