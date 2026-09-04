/**
 * AddSeriesDialog — Upload non-DICOM files (PDF, JPEG, PNG, STL) as a new series
 * in an existing study (OE2 "EnableAddSeries" equivalent).
 *
 * Uses Orthanc's /tools/create-dicom endpoint to encapsulate the file as a
 * DICOM instance within a new series.
 */
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { orthancFetch, JSON_CONTENT_HEADERS } from '@/lib/client';
import { getConfig } from '@/config/runtime';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface AddSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyId: string;
  patientId: string;
  patientName: string;
}

export default function AddSeriesDialog({
  open,
  onOpenChange,
  studyId,
  patientId,
  patientName,
}: AddSeriesDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [seriesDescription, setSeriesDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!seriesDescription) {
        setSeriesDescription(file.name.replace(/\.[^.]+$/, ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const orthancUrl = getConfig().orthancUrl;

        // Determine DICOM SOP Class based on file type
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

        // Create a new DICOM instance with the encapsulated file
        const body = {
          Tags: {
            PatientID: patientId,
            PatientName: patientName,
            StudyInstanceUID: studyId,
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
        const result = await response.json();

        toast.success(t('study.addSeriesSuccess', { defaultValue: 'Series added successfully' }));
        queryClient.invalidateQueries({ queryKey: ['study', studyId] });
        queryClient.invalidateQueries({ queryKey: ['studies'] });
        onOpenChange(false);
        setSelectedFile(null);
        setSeriesDescription('');
      };
      reader.readAsDataURL(selectedFile);
    } catch (e) {
      toast.error(t('study.addSeriesFailed', { defaultValue: 'Failed to add series' }));
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
            {t('study.addSeries', { defaultValue: 'Add Series (PDF/Image/STL)' })}
          </DialogTitle>
          <DialogDescription>
            {t('study.addSeriesDesc', { defaultValue: 'Upload a non-DICOM file as a new series in this study' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('study.addSeriesFile', { defaultValue: 'File (PDF, JPEG, PNG, STL)' })}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.stl"
              onChange={handleFileSelect}
              className="block w-full text-sm text-muted-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {selectedFile && (
              <p className="text-xs text-muted-foreground mt-1">
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t('study.addSeriesDescription', { defaultValue: 'Series Description' })}
            </label>
            <Input
              placeholder={t('study.addSeriesDescPlaceholder', { defaultValue: 'e.g. Report PDF' })}
              value={seriesDescription}
              onChange={(e) => setSeriesDescription(e.target.value)}
              className="h-9"
            />
          </div>

          <Button
            size="sm"
            className="gap-1.5 w-full"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            {t('study.addSeriesUpload', { defaultValue: 'Upload as Series' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
