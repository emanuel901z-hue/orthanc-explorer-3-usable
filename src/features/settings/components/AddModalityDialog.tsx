import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
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
  name: z.string().trim().min(1, 'required').max(100),
  aet: z.string().trim().min(1, 'required').max(16, 'aetMax').regex(/^[A-Z0-9_]+$/i, 'aetPattern'),
  host: z.string().trim().min(1, 'required').max(255),
  port: z.coerce.number().int().min(1, 'portMin').max(65535, 'portMax'),
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
  const { t } = useTranslation();
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
          <DialogTitle>
            {editModality ? t('modality.editTitle') : t('modality.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('modality.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mod-name">{t('modality.name')}</Label>
            <Input id="mod-name" placeholder={t('modality.namePlaceholder')} {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{t('modality.validation.required')}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mod-aet">{t('modality.aet')}</Label>
              <Input id="mod-aet" placeholder={t('modality.aetPlaceholder')} className="font-mono" {...register('aet')} />
              {errors.aet && (
                <p className="text-xs text-destructive">
                  {errors.aet.message === 'aetMax'
                    ? t('modality.validation.aetMax')
                    : errors.aet.message === 'aetPattern'
                      ? t('modality.validation.aetPattern')
                      : t('modality.validation.required')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="mod-port">{t('modality.port')}</Label>
              <Input id="mod-port" type="number" placeholder="104" {...register('port')} />
              {errors.port && (
                <p className="text-xs text-destructive">
                  {errors.port.message === 'portMin' || errors.port.message === 'portMax'
                    ? t('modality.validation.portRange')
                    : t('modality.validation.required')}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mod-host">{t('modality.host')}</Label>
            <Input id="mod-host" placeholder={t('modality.hostPlaceholder')} className="font-mono" {...register('host')} />
            {errors.host && <p className="text-xs text-destructive">{t('modality.validation.required')}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t('modality.manufacturer')}</Label>
            <Select value={manufacturer || ''} onValueChange={(v) => setValue('manufacturer', v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('modality.manufacturerPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {MANUFACTURERS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>{t('common.cancel')}</Button>
            <Button type="submit">{editModality ? t('modality.saveChanges') : t('modality.addButton')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
