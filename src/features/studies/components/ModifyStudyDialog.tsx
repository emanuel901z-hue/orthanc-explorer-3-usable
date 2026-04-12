import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pencil, ArrowRight, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import DicomTagBrowser, { type TagModification } from './DicomTagBrowser';
import { useJobStore } from '@/store/job-store';
import { toast } from 'sonner';

interface ModifyStudyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  study: {
    id: string;
    patientName: string;
    patientId: string;
    patientBirthDate?: Date;
    patientSex?: string;
    studyInstanceUID: string;
    studyDate: Date;
    studyDescription?: string;
    accessionNumber?: string;
  };
  instanceCount: number;
}

type Step = 'edit' | 'review';

// Threshold: if study has more than this many instances, run as background job
const JOB_THRESHOLD = 50;

export function ModifyStudyDialog({ open, onOpenChange, study, instanceCount }: ModifyStudyDialogProps) {
  const [step, setStep] = useState<Step>('edit');
  const [modifications, setModifications] = useState<TagModification[]>([]);
  const [applying, setApplying] = useState(false);
  const addJob = useJobStore((s) => s.addJob);

  const handleModificationsChange = useCallback((mods: TagModification[]) => {
    setModifications(mods);
  }, []);

  const willRunAsJob = instanceCount > JOB_THRESHOLD;

  const handleApply = () => {
    if (modifications.length === 0) return;

    if (willRunAsJob) {
      // Queue as background job
      const jobId = `modify-${study.id}-${Date.now()}`;
      addJob({
        id: jobId,
        type: 'modify',
        label: `Modify ${modifications.length} tag(s) on ${study.patientName.replace(/\^/g, ', ')}`,
        progress: 0,
        status: 'pending',
      });
      toast.success('Modification queued', {
        description: `${modifications.length} tag change(s) will be applied across ${instanceCount} instances.`,
      });
      onOpenChange(false);
      resetState();
    } else {
      // Simulate immediate apply
      setApplying(true);
      setTimeout(() => {
        setApplying(false);
        toast.success('Tags modified', {
          description: `${modifications.length} tag(s) updated successfully.`,
        });
        onOpenChange(false);
        resetState();
      }, 1200);
    }
  };

  const resetState = () => {
    setStep('edit');
    setModifications([]);
    setApplying(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) resetState();
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            {step === 'edit' ? 'Modify DICOM Tags' : 'Review Changes'}
          </DialogTitle>
          <DialogDescription>
            {step === 'edit'
              ? 'Double-click any tag value to edit it. UIDs and pixel data tags are read-only.'
              : `Review ${modifications.length} pending modification(s) before applying.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto min-h-0">
          {step === 'edit' ? (
            <DicomTagBrowser
              study={study}
              editable
              onModificationsChange={handleModificationsChange}
            />
          ) : (
            <div className="space-y-4">
              {/* Execution info */}
              <div className={`flex items-start gap-2 p-3 rounded-lg border ${willRunAsJob ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' : 'bg-muted border-border'}`}>
                {willRunAsJob ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium text-amber-700 dark:text-amber-400">Background job required</span>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        This study has {instanceCount} instances (threshold: {JOB_THRESHOLD}). Changes will be queued and applied in the background.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium">Immediate apply</span>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        This study has {instanceCount} instances. Changes will be applied immediately.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Changes table */}
              <div className="border rounded-md overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-[120px]">Tag</TableHead>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Original</TableHead>
                      <TableHead className="text-xs w-8"></TableHead>
                      <TableHead className="text-xs">New Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modifications.map((mod) => (
                      <TableRow key={mod.tag}>
                        <TableCell className="font-mono text-xs">{mod.tag}</TableCell>
                        <TableCell className="text-xs">{mod.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground line-through">
                          {mod.originalValue || <span className="italic">empty</span>}
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-amber-700 dark:text-amber-400 font-medium">
                          {mod.newValue || <span className="italic">empty</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <Separator />

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {modifications.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {modifications.length} change{modifications.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {step === 'review' && (
              <Button variant="outline" size="sm" onClick={() => setStep('edit')}>
                Back to Editor
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            {step === 'edit' ? (
              <Button
                size="sm"
                disabled={modifications.length === 0}
                onClick={() => setStep('review')}
              >
                Review Changes ({modifications.length})
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={applying}
                onClick={handleApply}
              >
                {applying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Applying…
                  </>
                ) : willRunAsJob ? (
                  'Queue Modification Job'
                ) : (
                  'Apply Changes'
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
