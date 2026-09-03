import { useState, useMemo, useCallback } from 'react';
import { Search, ChevronRight, ChevronDown, Undo2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface DicomTagEntry {
  tag: string;
  name: string;
  vr: string;
  value: string;
  children?: DicomTagEntry[];
}

// Tags that should never be editable (UIDs, pixel data, internal)
const NON_EDITABLE_TAGS = new Set([
  '(0002,0001)', '(0002,0002)', '(0002,0010)', '(0002,0012)', '(0002,0013)',
  '(0008,0016)', '(0008,0018)', '(0020,000D)', '(0020,000E)',
  '(0028,0002)', '(0028,0004)', '(0028,0010)', '(0028,0011)',
  '(0028,0100)', '(0028,0101)', '(0028,0102)', '(0028,0103)',
  '(0028,1052)', '(0028,1053)',
]);

export function generateStudyDemoTags(study: {
  patientName: string;
  patientId: string;
  patientBirthDate?: Date;
  patientSex?: string;
  studyInstanceUID: string;
  studyDate: Date;
  studyDescription?: string;
  accessionNumber?: string;
}): DicomTagEntry[] {
  const formatDate = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

  return [
    { tag: '(0002,0001)', name: 'File Meta Information Version', vr: 'OB', value: '00\\01' },
    { tag: '(0002,0002)', name: 'Media Storage SOP Class UID', vr: 'UI', value: '1.2.840.10008.5.1.4.1.1.2' },
    { tag: '(0002,0010)', name: 'Transfer Syntax UID', vr: 'UI', value: '1.2.840.10008.1.2.1' },
    { tag: '(0002,0012)', name: 'Implementation Class UID', vr: 'UI', value: '1.2.276.0.7230010.3.0.3.6.7' },
    { tag: '(0002,0013)', name: 'Implementation Version Name', vr: 'SH', value: 'ORTHANC-1.12.3' },
    { tag: '(0008,0005)', name: 'Specific Character Set', vr: 'CS', value: 'ISO_IR 100' },
    { tag: '(0008,0008)', name: 'Image Type', vr: 'CS', value: 'ORIGINAL\\PRIMARY\\AXIAL' },
    { tag: '(0008,0016)', name: 'SOP Class UID', vr: 'UI', value: '1.2.840.10008.5.1.4.1.1.2' },
    { tag: '(0008,0018)', name: 'SOP Instance UID', vr: 'UI', value: '1.2.840.113619.2.55.3.604688119.969.1364202859.810' },
    { tag: '(0008,0020)', name: 'Study Date', vr: 'DA', value: formatDate(study.studyDate) },
    { tag: '(0008,0030)', name: 'Study Time', vr: 'TM', value: '091523.000' },
    { tag: '(0008,0050)', name: 'Accession Number', vr: 'SH', value: study.accessionNumber || '' },
    { tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: 'CT' },
    { tag: '(0008,0070)', name: 'Manufacturer', vr: 'LO', value: 'GE MEDICAL SYSTEMS' },
    { tag: '(0008,0080)', name: 'Institution Name', vr: 'LO', value: 'MERCY GENERAL HOSPITAL' },
    { tag: '(0008,0090)', name: 'Referring Physician\'s Name', vr: 'PN', value: 'DR. WILSON^JAMES' },
    { tag: '(0008,1030)', name: 'Study Description', vr: 'LO', value: study.studyDescription || '' },
    { tag: '(0008,103E)', name: 'Series Description', vr: 'LO', value: 'CHEST W/O CONTRAST 5mm' },
    { tag: '(0008,1090)', name: 'Manufacturer\'s Model Name', vr: 'LO', value: 'Revolution CT' },
    {
      tag: '(0008,1115)', name: 'Referenced Series Sequence', vr: 'SQ', value: '1 item(s)', children: [
        { tag: '(0008,1150)', name: 'Referenced SOP Class UID', vr: 'UI', value: '1.2.840.10008.5.1.4.1.1.2' },
        { tag: '(0008,1155)', name: 'Referenced SOP Instance UID', vr: 'UI', value: '1.2.840.113619.2.55.3.2831133414.144.1364202859.678' },
        { tag: '(0020,000E)', name: 'Series Instance UID', vr: 'UI', value: '1.2.840.113619.2.55.3.604688119.969.1364202859.234' },
      ]
    },
    { tag: '(0010,0010)', name: 'Patient\'s Name', vr: 'PN', value: study.patientName },
    { tag: '(0010,0020)', name: 'Patient ID', vr: 'LO', value: study.patientId },
    { tag: '(0010,0030)', name: 'Patient\'s Birth Date', vr: 'DA', value: study.patientBirthDate ? formatDate(study.patientBirthDate) : '' },
    { tag: '(0010,0040)', name: 'Patient\'s Sex', vr: 'CS', value: study.patientSex || '' },
    { tag: '(0010,1010)', name: 'Patient\'s Age', vr: 'AS', value: '062Y' },
    { tag: '(0010,1030)', name: 'Patient\'s Weight', vr: 'DS', value: '78.5' },
    { tag: '(0018,0015)', name: 'Body Part Examined', vr: 'CS', value: 'CHEST' },
    { tag: '(0018,0050)', name: 'Slice Thickness', vr: 'DS', value: '5.000000' },
    { tag: '(0018,0060)', name: 'KVP', vr: 'DS', value: '120' },
    { tag: '(0018,0088)', name: 'Spacing Between Slices', vr: 'DS', value: '5.000000' },
    { tag: '(0018,0090)', name: 'Data Collection Diameter', vr: 'DS', value: '500.000000' },
    { tag: '(0018,1100)', name: 'Reconstruction Diameter', vr: 'DS', value: '360.000000' },
    { tag: '(0018,1110)', name: 'Distance Source to Detector', vr: 'DS', value: '949.075012' },
    { tag: '(0018,1120)', name: 'Gantry/Detector Tilt', vr: 'DS', value: '0.000000' },
    { tag: '(0018,1150)', name: 'Exposure Time', vr: 'IS', value: '570' },
    { tag: '(0018,1151)', name: 'X-Ray Tube Current', vr: 'IS', value: '210' },
    { tag: '(0018,1152)', name: 'Exposure', vr: 'IS', value: '3' },
    { tag: '(0018,1160)', name: 'Filter Type', vr: 'SH', value: 'BODY FILTER' },
    { tag: '(0018,1170)', name: 'Generator Power', vr: 'IS', value: '25200' },
    { tag: '(0018,1210)', name: 'Convolution Kernel', vr: 'SH', value: 'STANDARD' },
    { tag: '(0018,5100)', name: 'Patient Position', vr: 'CS', value: 'HFS' },
    { tag: '(0020,000D)', name: 'Study Instance UID', vr: 'UI', value: study.studyInstanceUID },
    { tag: '(0020,000E)', name: 'Series Instance UID', vr: 'UI', value: '1.2.840.113619.2.55.3.604688119.969.1364202859.234' },
    { tag: '(0020,0010)', name: 'Study ID', vr: 'SH', value: '4521' },
    { tag: '(0020,0011)', name: 'Series Number', vr: 'IS', value: '2' },
    { tag: '(0020,0013)', name: 'Instance Number', vr: 'IS', value: '1' },
    { tag: '(0020,0032)', name: 'Image Position (Patient)', vr: 'DS', value: '-178.3\\-319.7\\-455.0' },
    { tag: '(0020,0037)', name: 'Image Orientation (Patient)', vr: 'DS', value: '1.0\\0.0\\0.0\\0.0\\1.0\\0.0' },
    { tag: '(0020,1041)', name: 'Slice Location', vr: 'DS', value: '-455.000000' },
    { tag: '(0028,0002)', name: 'Samples per Pixel', vr: 'US', value: '1' },
    { tag: '(0028,0004)', name: 'Photometric Interpretation', vr: 'CS', value: 'MONOCHROME2' },
    { tag: '(0028,0010)', name: 'Rows', vr: 'US', value: '512' },
    { tag: '(0028,0011)', name: 'Columns', vr: 'US', value: '512' },
    { tag: '(0028,0030)', name: 'Pixel Spacing', vr: 'DS', value: '0.703125\\0.703125' },
    { tag: '(0028,0100)', name: 'Bits Allocated', vr: 'US', value: '16' },
    { tag: '(0028,0101)', name: 'Bits Stored', vr: 'US', value: '16' },
    { tag: '(0028,0102)', name: 'High Bit', vr: 'US', value: '15' },
    { tag: '(0028,0103)', name: 'Pixel Representation', vr: 'US', value: '1' },
    { tag: '(0028,1050)', name: 'Window Center', vr: 'DS', value: '40' },
    { tag: '(0028,1051)', name: 'Window Width', vr: 'DS', value: '400' },
    { tag: '(0028,1052)', name: 'Rescale Intercept', vr: 'DS', value: '-1024' },
    { tag: '(0028,1053)', name: 'Rescale Slope', vr: 'DS', value: '1' },
    {
      tag: '(0040,0275)', name: 'Request Attributes Sequence', vr: 'SQ', value: '1 item(s)', children: [
        { tag: '(0040,0007)', name: 'Scheduled Procedure Step Description', vr: 'LO', value: 'CT CHEST WO' },
        { tag: '(0040,0009)', name: 'Scheduled Procedure Step ID', vr: 'SH', value: 'SPS001' },
        { tag: '(0040,1001)', name: 'Requested Procedure ID', vr: 'SH', value: 'RP001' },
      ]
    },
  ];
}

const VR_COLORS: Record<string, string> = {
  SQ: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  UI: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  PN: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  DA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  TM: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  CS: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  DS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  IS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  US: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
};

export interface TagModification {
  tag: string;
  name: string;
  originalValue: string;
  newValue: string;
}

function TagRow({
  entry,
  depth = 0,
  search,
  editable,
  modifications,
  onModify,
}: {
  entry: DicomTagEntry;
  depth?: number;
  search: string;
  editable?: boolean;
  modifications?: Map<string, string>;
  onModify?: (tag: string, name: string, originalValue: string, newValue: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(entry.value);
  const hasChildren = entry.children && entry.children.length > 0;
  const vrClass = VR_COLORS[entry.vr] || 'bg-muted text-muted-foreground';
  const isEditable = editable && !NON_EDITABLE_TAGS.has(entry.tag) && entry.vr !== 'SQ';
  const modifiedValue = modifications?.get(entry.tag);
  const isModified = modifiedValue !== undefined;
  const displayValue = isModified ? modifiedValue : entry.value;

  const handleStartEdit = () => {
    if (!isEditable) return;
    setEditValue(displayValue);
    setEditing(true);
  };

  const handleCommit = () => {
    setEditing(false);
    if (editValue !== entry.value) {
      onModify?.(entry.tag, entry.name, entry.value, editValue);
    } else if (isModified) {
      // Reverted to original
      onModify?.(entry.tag, entry.name, entry.value, entry.value);
    }
  };

  const handleRevert = () => {
    setEditing(false);
    setEditValue(entry.value);
    onModify?.(entry.tag, entry.name, entry.value, entry.value);
  };

  return (
    <>
      <TableRow
        className={cn(
          'hover:bg-muted/50 transition-colors',
          hasChildren && 'cursor-pointer',
          depth > 0 && 'bg-muted/30',
          isModified && 'bg-amber-50 dark:bg-amber-950/30'
        )}
        onClick={hasChildren ? () => setExpanded(!expanded) : undefined}
      >
        <TableCell className="font-mono text-xs py-1.5" style={{ paddingLeft: `${12 + depth * 20}px` }}>
          <span className="flex items-center gap-1">
            {hasChildren && (expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
            {entry.tag}
          </span>
        </TableCell>
        <TableCell className="py-1.5">
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 font-mono', vrClass)}>{entry.vr}</Badge>
        </TableCell>
        <TableCell className="text-xs py-1.5">{entry.name}</TableCell>
        <TableCell className="font-mono text-xs py-1.5 max-w-[300px]">
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommit();
                  if (e.key === 'Escape') { setEditing(false); setEditValue(displayValue); }
                }}
                onBlur={handleCommit}
                autoFocus
                className="h-6 text-xs font-mono py-0 px-1.5"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <span
                className={cn(
                  'truncate',
                  isEditable && 'cursor-text',
                  isModified ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-muted-foreground'
                )}
                onDoubleClick={handleStartEdit}
                title={isEditable ? 'Double-click to edit' : 'Read-only tag'}
              >
                {displayValue || <span className="text-muted-foreground/40 italic">empty</span>}
              </span>
              {isModified && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0 opacity-60 hover:opacity-100" onClick={handleRevert}>
                      <Undo2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">Revert to: {entry.value}</TooltipContent>
                </Tooltip>
              )}
              {isEditable && !isModified && (
                <span className="text-muted-foreground/0 group-hover:text-muted-foreground/40 text-[9px] transition-colors">
                  dbl-click
                </span>
              )}
            </div>
          )}
        </TableCell>
      </TableRow>
      {hasChildren && expanded && entry.children!.map((child) => (
        <TagRow key={child.tag} entry={child} depth={depth + 1} search={search} editable={editable} modifications={modifications} onModify={onModify} />
      ))}
    </>
  );
}

interface DicomTagBrowserProps {
  study: {
    patientName: string;
    patientId: string;
    patientBirthDate?: Date;
    patientSex?: string;
    studyInstanceUID: string;
    studyDate: Date;
    studyDescription?: string;
    accessionNumber?: string;
  };
  /** Real DICOM tags fetched from Orthanc. If provided, demo tags are not used. */
  tags?: DicomTagEntry[];
  editable?: boolean;
  onModificationsChange?: (modifications: TagModification[]) => void;
}

export default function DicomTagBrowser({ study, tags, editable, onModificationsChange }: DicomTagBrowserProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'tag' | 'name' | 'vr' | 'value'>('tag');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const allTags = useMemo(
    () => tags ?? generateStudyDemoTags(study),
    [tags, study],
  );
  const [modifications, setModifications] = useState<Map<string, string>>(new Map());

  const handleModify = useCallback((tag: string, name: string, originalValue: string, newValue: string) => {
    setModifications((prev) => {
      const next = new Map(prev);
      if (newValue === originalValue) {
        next.delete(tag);
      } else {
        next.set(tag, newValue);
      }
      // Build TagModification list for parent
      const mods: TagModification[] = [];
      const tagLookup = new Map(allTags.map(t => [t.tag, t]));
      next.forEach((val, key) => {
        const entry = tagLookup.get(key);
        if (entry) mods.push({ tag: key, name: entry.name, originalValue: entry.value, newValue: val });
      });
      onModificationsChange?.(mods);
      return next;
    });
  }, [allTags, onModificationsChange]);

  const filtered = useMemo(() => {
    let result = allTags;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.tag.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.value.toLowerCase().includes(q) ||
          t.children?.some(
            (c) => c.tag.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
          )
      );
    }
    // Sort — only top-level tags (children stay in their original order within SQ items)
    const sorted = [...result].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      let cmp = 0;
      switch (sortKey) {
        case 'tag':
          cmp = a.tag.localeCompare(b.tag);
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'vr':
          cmp = a.vr.localeCompare(b.vr);
          break;
        case 'value':
          cmp = (a.value || '').localeCompare(b.value || '');
          break;
      }
      return cmp * dir;
    });
    return sorted;
  }, [allTags, search, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: typeof sortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 inline" />
      : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tags by name, tag ID, or value…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        {editable && modifications.size > 0 && (
          <Badge variant="secondary" className="text-xs">
            {modifications.size} modified
          </Badge>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {filtered.length} tags
        {editable && <span className="ml-2 text-muted-foreground/60">· Double-click a value to edit</span>}
      </div>
      <div className="overflow-auto max-h-[600px] border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px] text-xs cursor-pointer select-none" onClick={() => toggleSort('tag')}>
                Tag<SortIcon col="tag" />
              </TableHead>
              <TableHead className="w-[50px] text-xs cursor-pointer select-none" onClick={() => toggleSort('vr')}>
                VR<SortIcon col="vr" />
              </TableHead>
              <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('name')}>
                Name<SortIcon col="name" />
              </TableHead>
              <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort('value')}>
                Value<SortIcon col="value" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((entry) => (
              <TagRow
                key={entry.tag}
                entry={entry}
                search={search}
                editable={editable}
                modifications={modifications}
                onModify={handleModify}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
