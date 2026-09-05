import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnSizingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  Search,
  Filter,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  Tag,
  Send,
  HelpCircle,
  Eye,
  Loader2,
  Settings2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { useStudies } from '@/features/studies/hooks/use-studies';
import { Study, StudyFilters } from '@/shared/types';
import { ModalityBadge, formatPatientName } from '@/shared/components/ModalityBadge';
import SendStudyDialog from '@/features/studies/components/SendStudyDialog';
import QuickReportDialog from '@/features/studies/components/QuickReportDialog';
import { FileText } from 'lucide-react';
import { useFeature } from '@/config/features';
import { smartSearch } from '@/lib/smart-search';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { deleteStudyAction } from '@/actions/deleteStudy';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toolsApi } from '@/api/tools';

// OE2 has 21 modality filter options; OE3 now matches
const MODALITY_OPTIONS = [
  'CR', 'CT', 'MR', 'US', 'OT', 'BI', 'CD', 'DD', 'DG', 'DM',
  'DX', 'ES', 'ECG', 'HD', 'IO', 'LP', 'LS', 'MG', 'NM', 'PT',
  'RF', 'RG', 'RTDOSE', 'RTIMAGE', 'RTPLAN', 'RTRECORD', 'SR',
  'ST', 'TG', 'VA', 'XA',
];
const DEFAULT_PAGE_SIZE = 25;

/** Sortable header button — renders sort direction indicator. */
function SortableHeader({
  label,
  column,
  t,
}: {
  label: string;
  column: { toggleSorting: () => void; getIsSorted: () => false | 'asc' | 'desc' };
  t: (key: string) => string;
}) {
  const sorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 -ml-2 h-8 font-semibold"
      onClick={() => column.toggleSorting()}
    >
      {label}
      {sorted === 'asc' ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </Button>
  );
}

export default function StudyListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Default ordering from URL param `order-by` (e.g. "studyDate:desc" or "patientName:asc")
  const orderParam = searchParams.get('order-by') || '';
  const initialSorting: SortingState = orderParam
    ? [{ id: orderParam.split(':')[0], desc: orderParam.split(':')[1] === 'desc' }]
    : [{ id: 'studyDate', desc: true }];

  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [rowSelection, setRowSelection] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [reportStudy, setReportStudy] = useState<Study | null>(null);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    studyInstanceUID: false, // hidden by default (long UID)
    lastUpdate: false,       // hidden by default
    referringPhysician: false, // hidden by default
  });
  const [showColumnConfig, setShowColumnConfig] = useState(false);

  // RBAC feature flags — controlled by config.js (deployment-time)
  const canDownload = useFeature('download');
  const canEditLabels = useFeature('editLabels');
  const canSend = useFeature('send');
  const canDelete = useFeature('delete');

  const filters: StudyFilters = useMemo(
    () => ({
      patientName: searchParams.get('patientName') || undefined,
      patientId: searchParams.get('patientId') || undefined,
      accessionNumber: searchParams.get('accession') || undefined,
      studyDescription: searchParams.get('description') || undefined,
      modalities: searchParams.get('modality') ? [searchParams.get('modality')!] : undefined,
      labels: searchParams.get('labels') ? searchParams.get('labels')!.split(',').filter(Boolean) : undefined,
      labelsConstraint: (searchParams.get('labelMode') as 'All' | 'Any') || 'All',
      withoutLabels: searchParams.get('withoutLabels') === 'true',
    }),
    [searchParams],
  );

  const { data: studies = [], isLoading, isFetching } = useStudies(filters);
  const isMobile = useMediaQuery('(max-width: 767px)');

  // P0.3: Labels with counts — fetch all labels and their study counts
  const { data: allLabels = [] } = useQuery({
    queryKey: ['orthanc-labels'],
    queryFn: () => toolsApi.getLabels(),
    staleTime: 60_000, // labels don't change often
  });

  const { data: labelCounts = {} } = useQuery({
    queryKey: ['orthanc-label-counts', allLabels],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        allLabels.map(async (label) => {
          counts[label] = await toolsApi.countStudiesByLabel(label);
        }),
      );
      return counts;
    },
    enabled: allLabels.length > 0,
    staleTime: 60_000,
  });

  const activeLabels = useMemo(
    () => (searchParams.get('labels') || '').split(',').filter(Boolean),
    [searchParams],
  );

  const toggleLabel = useCallback(
    (label: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const current = (next.get('labels') || '').split(',').filter(Boolean);
        const idx = current.indexOf(label);
        if (idx >= 0) current.splice(idx, 1);
        else current.push(label);
        if (current.length > 0) next.set('labels', current.join(','));
        else next.delete('labels');
        return next;
      });
    },
    [setSearchParams],
  );

  // Smart search query — separate from structured Orthanc filters.
  // The smart search runs client-side across ALL fields (name, ID, date,
  // modality, description, accession, SIUID, referring physician).
  const smartQuery = searchParams.get('q') || '';

  // Apply smart search client-side on top of Orthanc results
  const filteredStudies = useMemo(() => {
    if (!smartQuery.trim()) return studies;
    return studies.filter((s) =>
      smartSearch(smartQuery, [
        s.patientName,
        s.patientId,
        s.studyDate,
        s.studyDescription,
        s.accessionNumber,
        s.studyInstanceUID,
        s.referringPhysician,
        s.modalities.join(' '),
        s.modalities.join(','),
        s.studyTime,
      ]),
    );
  }, [studies, smartQuery]);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      });
    },
    [setSearchParams],
  );

  const columns: ColumnDef<Study>[] = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        size: 40,
        enableSorting: false,
      },
      {
        accessorKey: 'patientName',
        header: ({ column }) => (
          <SortableHeader label={t('studies.patientName')} column={column} t={t} />
        ),
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{formatPatientName(row.original.patientName)}</span>
            <div className="text-xs text-muted-foreground">{row.original.patientId}</div>
          </div>
        ),
      },
      {
        accessorKey: 'studyDate',
        header: ({ column }) => (
          <SortableHeader label={t('studies.studyDate')} column={column} t={t} />
        ),
        cell: ({ row }) => (
          <div>
            <span>{format(row.original.studyDate, 'MMM dd, yyyy')}</span>
            {row.original.studyTime && (
              <div className="text-xs text-muted-foreground">{row.original.studyTime}</div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'modalities',
        header: ({ column }) => (
          <SortableHeader label={t('studyList.columns.modality')} column={column} t={t} />
        ),
        cell: ({ row }) => (
          <div className="flex gap-1">
            {row.original.modalities.map((m) => (
              <ModalityBadge key={m} modality={m} />
            ))}
          </div>
        ),
        // Sort by first modality string
        sortingFn: (a, b) => {
          const ma = a.original.modalities[0] ?? '';
          const mb = b.original.modalities[0] ?? '';
          return ma.localeCompare(mb);
        },
      },
      {
        accessorKey: 'studyDescription',
        header: ({ column }) => (
          <SortableHeader label={t('studyList.columns.description')} column={column} t={t} />
        ),
        cell: ({ row }) => (
          <span className="text-sm truncate max-w-[200px] block">
            {row.original.studyDescription || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'accessionNumber',
        header: ({ column }) => (
          <SortableHeader label={t('studyList.columns.accession')} column={column} t={t} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.accessionNumber || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'studyInstanceUID',
        header: ({ column }) => (
          <SortableHeader label={t('studyList.columns.studyInstanceUID')} column={column} t={t} />
        ),
        cell: ({ row }) => (
          <span
            className="font-mono text-xs text-muted-foreground block truncate max-w-[280px]"
            title={row.original.studyInstanceUID}
          >
            {row.original.studyInstanceUID || '—'}
          </span>
        ),
        size: 280,
        minSize: 200,
      },
      {
        accessorKey: 'lastUpdate',
        header: ({ column }) => (
          <SortableHeader label={t('studyList.columns.lastUpdate')} column={column} t={t} />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {format(row.original.lastUpdate, 'MMM dd, yyyy HH:mm')}
          </span>
        ),
        size: 140,
      },
      {
        accessorKey: 'referringPhysician',
        header: ({ column }) => (
          <SortableHeader label={t('studyList.columns.referring')} column={column} t={t} />
        ),
        cell: ({ row }) => (
          <span className="text-sm truncate max-w-[160px] block">
            {row.original.referringPhysician
              ? row.original.referringPhysician.replace(/\^/g, ', ')
              : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'numberOfInstances',
        header: ({ column }) => (
          <SortableHeader label={t('studyList.columns.images')} column={column} t={t} />
        ),
        cell: ({ row }) => (
          <div>
            <span className="font-medium">
              {row.original.numberOfInstances !== undefined ? row.original.numberOfInstances : '—'}
            </span>
            <div className="text-xs text-muted-foreground">
              {t('studyList.columns.seriesCount', { count: row.original.numberOfSeries })}
            </div>
          </div>
        ),
        sortingFn: (a, b) => {
          const ia = a.original.numberOfInstances ?? 0;
          const ib = b.original.numberOfInstances ?? 0;
          return ia - ib;
        },
      },
      // P0.1: Quick-Viewer button + Quick-Report button
      {
        id: 'quickViewer',
        header: () => <span className="text-xs font-semibold">{t('studyList.columns.view')}</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/viewer/${row.original.id}`);
                    }}
                    aria-label={t('studyList.quickViewer', { defaultValue: 'Open viewer' })}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('studyList.quickViewer', { defaultValue: 'Open viewer' })}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReportStudy(row.original);
                    }}
                    aria-label={t('studyList.quickReport', { defaultValue: 'Quick report' })}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('studyList.quickReport', { defaultValue: 'Quick report' })}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ),
        size: 90,
        enableSorting: false,
      },
      {
        id: 'status',
        accessorFn: (row) => (row.isStable ? 1 : 0),
        header: ({ column }) => (
          <SortableHeader label={t('studyList.columns.status')} column={column} t={t} />
        ),
        size: 120,
        minSize: 100,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <div
              className={`h-2 w-2 rounded-full ${row.original.isStable ? 'bg-success' : 'bg-warning animate-pulse'}`}
            />
            <span className="text-xs text-muted-foreground">
              {row.original.isStable
                ? t('studyList.status.stable')
                : t('studyList.status.receiving')}
            </span>
          </div>
        ),
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: filteredStudies,
    columns,
    state: { sorting, rowSelection, columnSizing, columnVisibility },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    initialState: { pagination: { pageSize: DEFAULT_PAGE_SIZE } },
  });

  const selectedCount = Object.keys(rowSelection).length;
  const queryClient = useQueryClient();

  // P0.2: Bulk delete selected studies
  const handleBulkDelete = async () => {
    const selectedRows = table.getSelectedRowModel().rows;
    setBulkDeleteLoading(true);
    let successCount = 0;
    let failCount = 0;
    for (const row of selectedRows) {
      try {
        await deleteStudyAction(row.original);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setBulkDeleteLoading(false);
    setDeleteOpen(false);
    setRowSelection({});
    if (successCount > 0) {
      toast.success(t('studyList.bulkDeleteSuccess', { count: successCount, defaultValue: `${successCount} study/studies deleted` }));
    }
    if (failCount > 0) {
      toast.error(t('studyList.bulkDeleteError', { count: failCount, defaultValue: `${failCount} study/studies could not be deleted` }));
    }
    queryClient.invalidateQueries({ queryKey: ['studies'] });
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('studies.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('studies.studiesFound', { count: filteredStudies.length })}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('studies.searchPlaceholderSmart')}
                aria-label={t('studies.searchPlaceholderSmart')}
                value={smartQuery}
                onChange={(e) => updateFilter('q', e.target.value)}
                className="pl-9"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-md text-xs">
                    <div className="space-y-1">
                      <p className="font-semibold">{t('search.helpTitle')}</p>
                      <p>{t('search.helpDescription')}</p>
                      <ul className="list-disc list-inside space-y-0.5 ml-2">
                        <li>{t('search.helpName')}</li>
                        <li>{t('search.helpDate')}</li>
                        <li>{t('search.helpModality')}</li>
                        <li>{t('search.helpAccession')}</li>
                        <li>{t('search.helpCombine')}</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2 shrink-0"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{t('studies.filters')}</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showFilters ? 'rotate-180' : ''}`}
              />
            </Button>
            {/* Column configuration dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowColumnConfig(!showColumnConfig)}
                className="gap-2 shrink-0"
              >
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">{t('studyList.columns.config')}</span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showColumnConfig ? 'rotate-180' : ''}`}
                />
              </Button>
              {showColumnConfig && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-lg shadow-lg p-3 min-w-[200px]">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {t('studyList.columns.toggle')}
                  </p>
                  <div className="space-y-1">
                    {table.getAllLeafColumns()
                      .filter((col) => col.id !== 'select' && col.id !== 'quickViewer')
                      .map((col) => (
                        <label key={col.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                          <Checkbox
                            checked={col.getIsVisible()}
                            onCheckedChange={(v) => col.toggleVisibility(!!v)}
                          />
                          <span>{col.columnDef.header && typeof col.columnDef.header === 'function'
                            ? col.id
                            : String(col.columnDef.header || col.id)}</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search hint */}
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
            <Search className="h-3 w-3" />
            <span>{t('search.hintText')}</span>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {t('studyList.filters.patientId')}
                </label>
                <Input
                  placeholder="PAT000..."
                  value={searchParams.get('patientId') || ''}
                  onChange={(e) => updateFilter('patientId', e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {t('studyList.filters.accession')}
                </label>
                <Input
                  placeholder="ACC..."
                  value={searchParams.get('accession') || ''}
                  onChange={(e) => updateFilter('accession', e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {t('studyList.filters.description')}
                </label>
                <Input
                  placeholder="CT Chest..."
                  value={searchParams.get('description') || ''}
                  onChange={(e) => updateFilter('description', e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {t('studyList.filters.modality')}
                </label>
                <Select
                  value={searchParams.get('modality') || 'all'}
                  onValueChange={(v) => updateFilter('modality', v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t('studyList.filters.allModalities')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('studyList.filters.allModalities')}</SelectItem>
                    {MODALITY_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* P0.3: Labels panel with study counts */}
      {allLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-xs font-semibold text-muted-foreground mr-1">{t('studyList.labels')}:</span>
          {allLabels.map((label) => {
            const isActive = activeLabels.includes(label);
            const count = labelCounts[label];
            return (
              <button
                key={label}
                onClick={() => toggleLabel(label)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <Tag className="h-3 w-3" />
                {label}
                {count !== undefined && (
                  <span className={`text-[10px] ${isActive ? 'opacity-80' : 'opacity-60'}`}>({count})</span>
                )}
              </button>
            );
          })}
          {/* Multi-Label AND/OR toggle (only when >1 label active) */}
          {activeLabels.length > 1 && (
            <button
              onClick={() => updateFilter('labelMode', searchParams.get('labelMode') === 'Any' ? '' : 'Any')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                searchParams.get('labelMode') === 'Any'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {searchParams.get('labelMode') === 'Any'
                ? t('studyList.labelModeAny')
                : t('studyList.labelModeAll')}
            </button>
          )}
          {/* "Without labels" filter toggle */}
          <button
            onClick={() => updateFilter('withoutLabels', searchParams.get('withoutLabels') === 'true' ? '' : 'true')}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
              searchParams.get('withoutLabels') === 'true'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Tag className="h-3 w-3" />
            {t('studyList.withoutLabels', { defaultValue: 'Without labels' })}
          </button>
        </div>
      )}

      {/* Bulk actions */}
      {selectedCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg animate-fade-in">
          <span className="text-sm font-medium">
            {t('studyList.selected', { count: selectedCount })}
          </span>
          <div className="flex gap-1 flex-wrap justify-center sm:ml-auto">
            {canDownload && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8">
                <Download className="h-3.5 w-3.5" /> {t('studyList.actions.export')}
              </Button>
            )}
            {canEditLabels && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8">
                <Tag className="h-3.5 w-3.5" /> {t('studyList.actions.label')}
              </Button>
            )}
            {canSend && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8"
                onClick={() => setSendOpen(true)}
              >
                <Send className="h-3.5 w-3.5" /> {t('studyList.actions.send')}
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> {t('studyList.actions.delete')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table (desktop) / Cards (mobile) */}
      <Card className="relative">
        {isFetching && !isLoading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/40 rounded-t-lg z-10 animate-pulse" />
        )}
        {isMobile ? (
          /* ── Mobile Card View ── */
          <div className="divide-y">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {t('studyList.empty')}
              </div>
            ) : (
              table.getRowModel().rows.map((row) => {
                const s = row.original;
                return (
                  <div
                    key={row.id}
                    data-testid="study-card"
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${row.getIsSelected() ? 'bg-primary/5' : ''}`}
                    onClick={() => navigate(`/studies/${s.id}`)}
                  >
                    {/* Top row: checkbox + patient name + status dot */}
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(v) => row.toggleSelected(!!v)}
                        aria-label="Select row"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {formatPatientName(s.patientName)}
                          </span>
                          <div
                            className={`h-2 w-2 rounded-full shrink-0 ${s.isStable ? 'bg-success' : 'bg-warning animate-pulse'}`}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">{s.patientId}</div>
                      </div>
                      {/* Quick actions */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => { e.stopPropagation(); navigate(`/viewer/${s.id}`); }}
                          aria-label={t('studyList.quickViewer', { defaultValue: 'Open viewer' })}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => { e.stopPropagation(); setReportStudy(s); }}
                          aria-label={t('studyList.quickReport', { defaultValue: 'Quick report' })}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {/* Meta grid: date, modality, accession, images */}
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">{t('studies.studyDate')}: </span>
                        <span>{format(s.studyDate, 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">{t('studyList.columns.modality')}: </span>
                        {s.modalities.map((m) => (
                          <ModalityBadge key={m} modality={m} />
                        ))}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('studyList.columns.accession')}: </span>
                        <span className="font-mono">{s.accessionNumber || '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('studyList.columns.images')}: </span>
                        <span className="font-medium">{s.numberOfInstances ?? '—'}</span>
                        <span className="text-muted-foreground"> ({t('studyList.columns.seriesCount', { count: s.numberOfSeries })})</span>
                      </div>
                    </div>
                    {/* Description (if present) */}
                    {s.studyDescription && (
                      <div className="mt-2 text-xs text-muted-foreground truncate">
                        {s.studyDescription}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
        /* ── Desktop Table View ── */
        <div className="overflow-auto">
          <Table style={{ tableLayout: 'auto', minWidth: '1200px' }}>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize(), position: 'relative' }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanResize() && (
                        <span
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-border/0 hover:bg-primary/40 active:bg-primary/60 transition-colors"
                          style={{
                            transform: header.column.getIsResizing()
                              ? `translateX(${header.column.getResizeOffset()}px)`
                              : '',
                          }}
                        />
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, ci) => (
                      <TableCell key={ci}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center py-12 text-muted-foreground"
                  >
                    {t('studyList.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-testid="study-row"
                    data-state={row.getIsSelected() && 'selected'}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/studies/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t gap-2">
          <span className="text-sm text-muted-foreground text-center sm:text-left">
            {t('studyList.pagination.showing', {
              from:
                table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1,
              to: Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                filteredStudies.length,
              ),
              total: filteredStudies.length,
            })}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              {t('studyList.pagination.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              {t('studyList.pagination.next')}
            </Button>
          </div>
        </div>
      </Card>

      <SendStudyDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        studies={table.getSelectedRowModel().rows.map((r) => ({
          id: r.original.id,
          patientName: formatPatientName(r.original.patientName),
          studyDescription: r.original.studyDescription,
        }))}
      />

      {/* P0.2: Bulk delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('studyList.bulkDeleteTitle', { defaultValue: 'Delete selected studies?' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('studyList.bulkDeleteConfirm', {
                count: selectedCount,
                defaultValue: `You are about to permanently delete ${selectedCount} study/studies. This action cannot be undone.`,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteLoading}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('common.deleting', { defaultValue: 'Deleting...' })}</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> {t('studyList.actions.delete', { defaultValue: 'Delete' })}</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Report Dialog */}
      <QuickReportDialog
        open={!!reportStudy}
        onOpenChange={(o) => !o && setReportStudy(null)}
        study={reportStudy}
      />
    </div>
  );
}
