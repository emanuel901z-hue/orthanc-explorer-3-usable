/**
 * AddSeriesDialog — Upload non-DICOM files (PDF, JPEG, PNG, STL) as a new series
 * OR upload real DICOM files and merge them into the existing study.
 */
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { JSON_CONTENT_HEADERS } from '@/lib/client';
import { getConfig } from '@/config/runtime';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { addDicomToStudyAction } from '@/actions/addDicomToStudy';
import { formatDiskSize } from '@/shared/utils/format';

interface AddSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyId: string;
  studyInstanceUid: string;
  patientId: string;
  patientName: string;
}

export default function AddSeriesDialog({
  open,
  onOpenChange,
  studyId,
  studyInstanceUid,
  patientId,
  patientName,
}: AddSeriesDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dicomMode, setDicomMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [seriesDescription, setSeriesDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setSelectedFiles(files);
      if (!dicomMode && files.length === 1 && !seriesDescription) {
        setSeriesDescription(files[0].name.replace(/\.[^.]+$/, ''));
      }
    }
  };

  const reset = () => {
    setSelectedFiles([]);
    setSeriesDescription('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadEncapsulated = async () => {
    const selectedFile = selectedFiles[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const orthancUrl = getConfig().orthancUrl;

      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      let sopClassUID = '1.2.840.10008.5.1.4.1.1.104.1'; // Encapsulated PDF
      let mimeType = 'application/pdf';

      if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
        sopClassUID = '1.2.840.10008.5.1.4.1.1.7'; // Secondary Capture
        mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
      } else if (ext === 'stl') {
        sopClassUID = '1.2.840.10008.5.1.4.1.1.104.3'; // STL Encapsulation
        mimeType = 'model/stl';
      }

      const body = {
        Tags: {
          PatientID: patientId,
          PatientName: patientName,
          StudyInstanceUID: studyInstanceUid,
          SeriesDescription: seriesDescription || selectedFile.name,
          Modality: 'OT',
          SOPClassUID: sopClassUID,
          MIMETypeOfEncapsulatedDocument: mimeType,
          EncapsulatedDocument: base64,
        },
        ParentStudy: studyId,
      };

      const response = await fetch(`${orthancUrl}/tools/create-dicom`, {
        method: 'POST',
        headers: { ...JSON_CONTENT_HEADERS, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await response.json();

      toast.success(t('study.addSeriesSuccess', { defaultValue: 'Series added successfully' }));
      queryClient.invalidateQueries({ queryKey: ['study', studyId] });
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      onOpenChange(false);
      reset();
    };
    reader.readAsDataURL(selectedFile);
  };

  const uploadDicom = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const result = await addDicomToStudyAction(studyId, selectedFiles);
      const hasIssues = result.failed > 0 || result.skipped > 0;

      if (!hasIssues) {
        toast.success(
          t('study.addDicomSuccess', {
            defaultValue: '{{uploaded}} DICOM files uploaded, {{merged}} studies merged',
            uploaded: result.uploaded,
            merged: result.merged,
          }),
        );
      } else {
        toast.warning(
          t('study.addDicomPartial', {
            defaultValue: '{{uploaded}} uploaded, {{failed}} failed, {{merged}} merged, {{skipped}} skipped',
            uploaded: result.uploaded,
            failed: result.failed,
            merged: result.merged,
            skipped: result.skipped,
          }),
        );
        if (result.skipped > 0) {
          toast.info(
            t('study.addDicomPatientMismatch', {
              defaultValue: '{{count}} source study/studies belong to a different patient and were not merged.',
              count: result.skipped,
            }),
            { duration: 6000 },
          );
        }
      }
      queryClient.invalidateQueries({ queryKey: ['study', studyId] });
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      onOpenChange(false);
      reset();
    } catch {
      toast.error(t('study.addDicomFailed', { defaultValue: 'DICOM upload or merge failed' }));
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    try {
      if (dicomMode) {
        await uploadDicom();
      } else {
        await uploadEncapsulated();
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t('study.addSeries', { defaultValue: 'Add Series' })}
          </DialogTitle>
          <DialogDescription>
            {t('study.addSeriesDesc', { defaultValue: 'Add a new series to this study' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t('study.addDicomMode', { defaultValue: 'DICOM upload' })}</p>
              <p className="text-xs text-muted-foreground">
                {t('study.addDicomModeHelp', { defaultValue: 'Upload real DICOM files and merge into this study' })}
              </p>
            </div>
            <Switch checked={dicomMode} onCheckedChange={(v) => { setDicomMode(v); setSelectedFiles([]); setSeriesDescription(''); }} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {dicomMode
                ? t('study.addDicomFile', { defaultValue: 'DICOM files (*.dcm)' })
                : t('study.addSeriesFile', { defaultValue: 'File (PDF, JPEG, PNG, STL)' })}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple={dicomMode}
              accept={dicomMode ? '.dcm,application/dicom' : '.pdf,.jpg,.jpeg,.png,.stl'}
              onChange={handleFileSelect}
              className="block w-full text-sm text-muted-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {selectedFiles.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {selectedFiles.map((f) => `${f.name} (${formatDiskSize(f.size)})`).join(', ')}
              </p>
            )}
          </div>

          {!dicomMode && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('study.addSeriesDescription', { defaultValue: 'Series Description' })}
              </Label>
              <Input
                placeholder={t('study.addSeriesDescPlaceholder', { defaultValue: 'e.g. Report PDF' })}
                value={seriesDescription}
                onChange={(e) => setSeriesDescription(e.target.value)}
                className="h-9"
              />
            </div>
          )}

          <Button
            size="sm"
            className="gap-1.5 w-full"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            {dicomMode
              ? t('study.addDicomUpload', { defaultValue: 'Upload DICOM & merge' })
              : t('study.addSeriesUpload', { defaultValue: 'Upload as Series' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
