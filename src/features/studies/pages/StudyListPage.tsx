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
import { useFeature } from '@/config/features';
import { smartSearch } from '@/lib/smart-search';

const MODALITY_OPTIONS = ['CT', 'MR', 'US', 'CR', 'DX', 'PT', 'NM'];
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

  const [sorting, setSorting] = useState<SortingState>([{ id: 'studyDate', desc: true }]);
  const [rowSelection, setRowSelection] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

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
    }),
    [searchParams],
  );

  const { data: studies = [], isLoading, isFetching } = useStudies(filters);

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
    state: { sorting, rowSelection, columnSizing },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    initialState: { pagination: { pageSize: DEFAULT_PAGE_SIZE } },
  });

  const selectedCount = Object.keys(rowSelection).length;

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
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              {t('studies.filters')}
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showFilters ? 'rotate-180' : ''}`}
              />
            </Button>
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
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> {t('studyList.actions.delete')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="relative">
        {isFetching && !isLoading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/40 rounded-t-lg z-10 animate-pulse" />
        )}
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
    </div>
  );
}
