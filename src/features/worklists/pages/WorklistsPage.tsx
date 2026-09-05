/**
 * WorklistsPage — DICOM Modality Worklist (MPPS) management.
 *
 * Lists worklist files, allows upload, query, and deletion.
 * Requires the Orthanc Worklists plugin to be installed.
 */
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Upload, Trash2, Loader2, FileText, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { worklistsApi } from '@/api/worklists';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function WorklistsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: worklistIds = [], isLoading, error } = useQuery({
    queryKey: ['worklists'],
    queryFn: () => worklistsApi.list().catch(() => [] as string[]),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => worklistsApi.delete(id),
    onSuccess: () => {
      toast.success(t('worklists.deleted'));
      queryClient.invalidateQueries({ queryKey: ['worklists'] });
    },
    onError: () => toast.error(t('worklists.deleteFailed')),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => worklistsApi.upload(file),
    onSuccess: () => {
      toast.success(t('worklists.uploaded'));
      queryClient.invalidateQueries({ queryKey: ['worklists'] });
    },
    onError: () => toast.error(t('worklists.uploadFailed')),
  });

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            {t('worklists.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('worklists.subtitle')}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{t('worklists.upload')}</span>
          <span className="sm:hidden">Upload</span>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".dcm,.dicom,application/dicom"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-3 text-sm text-amber-700 dark:text-amber-400">
            {t('worklists.pluginNotInstalled')}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {t('worklists.count', { count: worklistIds.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : worklistIds.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {t('worklists.empty')}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <Table className="hidden sm:table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">ID</TableHead>
                    <TableHead>{t('worklists.type')}</TableHead>
                    <TableHead className="w-[100px]">{t('worklists.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {worklistIds.map((id) => (
                    <TableRow key={id}>
                      <TableCell className="font-mono text-xs">{id.substring(0, 12)}...</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs gap-1">
                          <FileText className="h-3 w-3" /> {t('worklists.worklist')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => deleteMutation.mutate(id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* Mobile cards */}
              <div className="sm:hidden divide-y">
                {worklistIds.map((id) => (
                  <div key={id} className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Badge variant="outline" className="text-xs gap-1 mb-1">
                        <FileText className="h-3 w-3" /> {t('worklists.worklist')}
                      </Badge>
                      <p className="font-mono text-xs truncate">{id}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive shrink-0"
                      onClick={() => deleteMutation.mutate(id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
