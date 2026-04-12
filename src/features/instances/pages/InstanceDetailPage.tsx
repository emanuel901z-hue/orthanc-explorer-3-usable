import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Image, HardDrive, Search, Send, Eye, Trash2, Pencil, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useInstance, useStudy, useSeries } from '@/features/studies/hooks/use-studies';
import { formatDiskSize, formatPatientName } from '@/shared/components/ModalityBadge';
import SendStudyDialog from '@/features/studies/components/SendStudyDialog';
import { useTabLabel } from '@/shared/hooks/use-tab-label';
import { AnonymizeDialog } from '@/features/studies/components/AnonymizeDialog';
import { useAuditLog } from '@/features/audit/hooks/use-audit-log';

export default function InstanceDetailPage() {
  const { t } = useTranslation();
  const { studyId, seriesId, instanceId } = useParams<{
    studyId: string;
    seriesId: string;
    instanceId: string;
  }>();
  const navigate = useNavigate();
  const { data: instance, isLoading } = useInstance(instanceId!);
  const { data: study } = useStudy(studyId!);
  const { data: seriesData } = useSeries(seriesId!);
  const [tagSearch, setTagSearch] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [anonOpen, setAnonOpen] = useState(false);
  const { audit } = useAuditLog();

  // Update tab label with patient name when loaded
  useTabLabel(study ? formatPatientName(study.patientName) : undefined);

  const filteredTags = useMemo(() => {
    if (!instance) return [];
    if (!tagSearch) return instance.tags;
    const q = tagSearch.toLowerCase();
    return instance.tags.filter(
      (t) =>
        t.tag.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.value.toLowerCase().includes(q)
    );
  }, [instance, tagSearch]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-muted-foreground">Instance not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate(`/studies/${studyId}/series/${seriesId}`)}
        >
          Back to Series
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 animate-fade-in">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); navigate('/studies'); }}>Studies</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); navigate(`/studies/${studyId}`); }}>
                {study ? formatPatientName(study.patientName) : studyId}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#" onClick={(e) => { e.preventDefault(); navigate(`/studies/${studyId}/series/${seriesId}`); }}>
                Series #{seriesData?.seriesNumber ?? '…'}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Instance #{instance.instanceNumber}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> Viewer</Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { audit({ action: 'download', title: 'Instance downloaded', resource: `Instance #${instance.instanceNumber}`, description: `Downloaded instance as DICOM Part 10 file` }); }}><Download className="h-3.5 w-3.5" /> Download</Button>
              </TooltipTrigger>
              <TooltipContent>Download as DICOM Part 10 file</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setSendOpen(true); audit({ action: 'send', title: 'Instance send initiated', resource: `Instance #${instance.instanceNumber}` }); }}><Send className="h-3.5 w-3.5" /> Send</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { audit({ action: 'modify', title: 'Instance modify initiated', resource: `Instance #${instance.instanceNumber}` }); }}><Pencil className="h-3.5 w-3.5" /> Modify</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setAnonOpen(true); audit({ action: 'anonymize', title: 'Instance anonymize initiated', resource: `Instance #${instance.instanceNumber}` }); }}><Shield className="h-3.5 w-3.5" /> Anonymize</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Instance</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete Instance #{instance.instanceNumber} ({formatDiskSize(instance.fileSize)}). This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { audit({ action: 'delete', title: 'Instance deleted', severity: 'warning', resource: `Instance #${instance.instanceNumber}`, description: `Deleted instance (${formatDiskSize(instance.fileSize)})` }); }}>Delete Permanently</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left — instance metadata */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Instance Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                  <Image className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">Instance #{instance.instanceNumber}</p>
                  <p className="text-xs text-muted-foreground">{formatDiskSize(instance.fileSize)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">Instance #</span>
                <span>{instance.instanceNumber}</span>
                <span className="text-muted-foreground">File Size</span>
                <span>{formatDiskSize(instance.fileSize)}</span>
                {instance.transferSyntax && (
                  <>
                    <span className="text-muted-foreground">Transfer Syntax</span>
                    <span className="font-mono text-xs break-all">{instance.transferSyntax}</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Identifiers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs mb-0.5">SOP Instance UID</span>
                <code className="font-dicom text-xs break-all">{instance.sopInstanceUID}</code>
              </div>
              {instance.sopClassUID && (
                <div>
                  <span className="text-muted-foreground block text-xs mb-0.5">SOP Class UID</span>
                  <code className="font-dicom text-xs break-all">{instance.sopClassUID}</code>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Image preview placeholder */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-square bg-muted rounded-lg flex flex-col items-center justify-center">
                <Image className="h-12 w-12 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">
                  Image preview available when connected to Orthanc
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right — DICOM Tags */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  DICOM Tags
                  <Badge variant="secondary" className="ml-2">{instance.tags.length}</Badge>
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search tags..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Tag</TableHead>
                      <TableHead className="w-16">VR</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTags.map((tag) => (
                      <TableRow key={tag.tag}>
                        <TableCell className="font-mono text-xs text-primary">{tag.tag}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] py-0 h-5 font-mono">
                            {tag.vr}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{tag.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[300px] truncate">
                          {tag.value}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredTags.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No tags match "{tagSearch}"
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {instance && (
        <SendStudyDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          studies={[{
            id: instance.id,
            patientName: `Instance #${instance.instanceNumber}`,
            studyDescription: formatDiskSize(instance.fileSize),
          }]}
        />
      )}
      {instance && (
        <AnonymizeDialog
          open={anonOpen}
          onOpenChange={setAnonOpen}
          level="instance"
          resourceId={instance.id}
          resourceLabel={`Instance #${instance.instanceNumber}`}
        />
      )}
    </div>
  );
}
