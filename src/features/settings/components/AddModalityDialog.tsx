import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DicomModality } from '@/shared/types';

const modalitySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  aet: z.string().trim().min(1, 'AET is required').max(16, 'AET must be ≤16 characters').regex(/^[A-Z0-9_]+$/i, 'Only letters, numbers, underscores'),
  host: z.string().trim().min(1, 'Host is required').max(255),
  port: z.coerce.number().int().min(1, 'Port must be ≥1').max(65535, 'Port must be ≤65535'),
  manufacturer: z.string().trim().max(100).optional(),
});

type ModalityFormValues = z.infer<typeof modalitySchema>;

interface AddModalityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editModality?: DicomModality | null;
  onSave: (values: ModalityFormValues) => void;
}

const MANUFACTURERS = ['Siemens', 'GE Healthcare', 'Philips', 'Canon', 'Fujifilm', 'Hologic', 'Other'];

export default function AddModalityDialog({ open, onOpenChange, editModality, onSave }: AddModalityDialogProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ModalityFormValues>({
    resolver: zodResolver(modalitySchema),
    defaultValues: editModality
      ? { name: editModality.name, aet: editModality.aet, host: editModality.host, port: editModality.port, manufacturer: editModality.manufacturer || '' }
      : { name: '', aet: '', host: '', port: 104, manufacturer: '' },
  });

  const manufacturer = watch('manufacturer');

  useEffect(() => {
    if (open) {
      reset(editModality
        ? { name: editModality.name, aet: editModality.aet, host: editModality.host, port: editModality.port, manufacturer: editModality.manufacturer || '' }
        : { name: '', aet: '', host: '', port: 104, manufacturer: '' });
    }
  }, [open, editModality, reset]);

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => reset(), 200);
  };

  const onSubmit = (values: ModalityFormValues) => {
    onSave(values);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editModality ? 'Edit Modality' : 'Add DICOM Modality'}</DialogTitle>
          <DialogDescription>
            Configure a DICOM modality for C-STORE, C-FIND, and C-MOVE operations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mod-name">Name</Label>
            <Input id="mod-name" placeholder="CT Scanner Main" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mod-aet">AET (Application Entity Title)</Label>
              <Input id="mod-aet" placeholder="CT_MAIN" className="font-mono" {...register('aet')} />
              {errors.aet && <p className="text-xs text-destructive">{errors.aet.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="mod-port">Port</Label>
              <Input id="mod-port" type="number" placeholder="104" {...register('port')} />
              {errors.port && <p className="text-xs text-destructive">{errors.port.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mod-host">Host / IP Address</Label>
            <Input id="mod-host" placeholder="192.168.1.10" className="font-mono" {...register('host')} />
            {errors.host && <p className="text-xs text-destructive">{errors.host.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Manufacturer</Label>
            <Select value={manufacturer || ''} onValueChange={(v) => setValue('manufacturer', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select manufacturer (optional)" />
              </SelectTrigger>
              <SelectContent>
                {MANUFACTURERS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit">{editModality ? 'Save Changes' : 'Add Modality'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
