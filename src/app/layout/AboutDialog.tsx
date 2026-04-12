import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const systemInfo = [
  { label: 'App Version', value: '0.1.0' },
  { label: 'Orthanc Version', value: '1.12.4 (demo)' },
  { label: 'DICOM Protocol', value: '3.0' },
  { label: 'Storage Backend', value: 'In-Memory (Demo)' },
  { label: 'Platform', value: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown' },
  { label: 'User Agent', value: typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').slice(-1)[0] : 'Unknown' },
];

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Orthanc Explorer
            <Badge variant="secondary" className="text-[10px]">v0.1.0</Badge>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          A modern web-based DICOM viewer and PACS management interface built on Orthanc.
        </p>

        <Separator />

        <div className="space-y-2">
          <h4 className="text-sm font-medium">System Information</h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {systemInfo.map((item) => (
              <div key={item.label} className="contents">
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="font-mono text-xs truncate">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Separator />

        <p className="text-[11px] text-muted-foreground text-center">
          © 2026 OrthancExplorer · MIT License
        </p>
      </DialogContent>
    </Dialog>
  );
}
