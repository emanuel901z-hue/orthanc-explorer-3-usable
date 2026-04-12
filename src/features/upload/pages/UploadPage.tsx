import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileUp, X, CheckCircle2, AlertCircle, Clock, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUploadStore } from '@/store/upload-store';
import { useJobStore } from '@/store/job-store';

export default function UploadPage() {
  const { t } = useTranslation();
  const { addFiles } = useUploadStore();
  const { jobs, removeJob, clearCompleted, retryJob } = useJobStore();
  const uploadJobs = jobs.filter((j) => j.type === 'upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const collectFiles = useCallback(async (entries: DataTransferItem[]): Promise<File[]> => {
    const files: File[] = [];
    const readEntry = (entry: FileSystemEntry): Promise<void> => {
      return new Promise((resolve) => {
        if (entry.isFile) {
          (entry as FileSystemFileEntry).file((f) => { files.push(f); resolve(); });
        } else if (entry.isDirectory) {
          const reader = (entry as FileSystemDirectoryEntry).createReader();
          reader.readEntries(async (entries) => {
            for (const e of entries) await readEntry(e);
            resolve();
          });
        } else {
          resolve();
        }
      });
    };
    for (const item of entries) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) await readEntry(entry);
    }
    return files;
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const items = Array.from(e.dataTransfer.items);
    if (items.length && items[0].webkitGetAsEntry) {
      const files = await collectFiles(items);
      if (files.length) addFiles(files);
    } else {
      const files = Array.from(e.dataTransfer.files);
      if (files.length) addFiles(files);
    }
  }, [addFiles, collectFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) addFiles(files);
    e.target.value = '';
  }, [addFiles]);

  const completedCount = uploadJobs.filter((q) => q.status === 'complete').length;
  const errorCount = uploadJobs.filter((q) => q.status === 'error' || q.status === 'interrupted').length;
  const totalProgress = uploadJobs.length > 0
    ? uploadJobs.reduce((sum, q) => sum + (q.status === 'complete' ? 100 : q.progress), 0) / uploadJobs.length
    : 0;

  const STATUS_ICON = {
    pending: <Clock className="h-4 w-4 text-muted-foreground" />,
    running: <Upload className="h-4 w-4 text-primary animate-pulse" />,
    complete: <CheckCircle2 className="h-4 w-4 text-success" />,
    error: <AlertCircle className="h-4 w-4 text-destructive" />,
    interrupted: <AlertTriangle className="h-4 w-4 text-warning" />,
  };

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      <div>
        <p className="text-sm text-muted-foreground">{t('upload.subtitle')}</p>
      </div>

      {/* Drop zone */}
      <Card>
        <CardContent className="p-0">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-border rounded-lg m-4 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <FileUp className="h-8 w-8 text-primary" />
            </div>
             <p className="font-medium text-foreground mb-1">{t('upload.dropTitle')}</p>
             <p className="text-sm text-muted-foreground mb-4">{t('upload.dropSubtitle')}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">{t('upload.selectFiles')}</Button>
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}>{t('upload.selectFolder')}</Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".dcm,.DCM,.dicom"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              {...{ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>}
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </CardContent>
      </Card>

      {/* Queue */}
      {uploadJobs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {t('upload.queue')}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {t('upload.complete', { completed: completedCount, total: uploadJobs.length })}
                  {errorCount > 0 && <span className="text-destructive ml-1">{t('upload.failed', { count: errorCount })}</span>}
                </span>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={clearCompleted} disabled={completedCount === 0}>
                {t('upload.clearCompleted')}
              </Button>
            </div>
            {uploadJobs.some((q) => q.status === 'running') && (
              <Progress value={totalProgress} className="h-1.5 mt-2" />
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('upload.fileName')}</TableHead>
                  <TableHead>{t('common.size')}</TableHead>
                  <TableHead>{t('upload.progress')}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadJobs.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{STATUS_ICON[item.status]}</TableCell>
                    <TableCell className="font-mono text-sm">{item.label}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.description}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={item.status === 'complete' ? 100 : item.progress} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(item.status === 'complete' ? 100 : item.progress)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {(item.status === 'error' || item.status === 'interrupted') && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => retryJob(item.id)}>
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => removeJob(item.id)}
                          disabled={item.status === 'running'}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
