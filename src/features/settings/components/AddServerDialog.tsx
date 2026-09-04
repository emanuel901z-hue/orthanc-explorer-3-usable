import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DicomWebServer } from '@/shared/types';

const serverSchema = z.object({
  name: z.string().trim().min(1, 'required').max(100),
  url: z.string().trim().min(1, 'required').url('urlInvalid'),
  authType: z.enum(['none', 'basic', 'bearer', 'oauth']),
  username: z.string().trim().max(100).optional(),
  clientId: z.string().trim().max(200).optional(),
  clientSecret: z.string().trim().max(200).optional(),
  hasQidoSupport: z.boolean(),
  hasWadoSupport: z.boolean(),
  hasStowSupport: z.boolean(),
});

type ServerFormValues = z.infer<typeof serverSchema>;

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editServer?: DicomWebServer | null;
  onSave: (values: ServerFormValues) => void;
}

export default function AddServerDialog({ open, onOpenChange, editServer, onSave }: AddServerDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ServerFormValues>({
    resolver: zodResolver(serverSchema),
    defaultValues: editServer
      ? {
          name: editServer.name,
          url: editServer.url,
          authType: editServer.authType,
          username: editServer.username || '',
          clientId: editServer.clientId || '',
          clientSecret: editServer.clientSecret || '',
          hasQidoSupport: editServer.hasQidoSupport,
          hasWadoSupport: editServer.hasWadoSupport,
          hasStowSupport: editServer.hasStowSupport,
        }
      : {
          name: '',
          url: '',
          authType: 'none' as const,
          username: '',
          clientId: '',
          clientSecret: '',
          hasQidoSupport: true,
          hasWadoSupport: true,
          hasStowSupport: true,
        },
  });

  const authType = watch('authType');

  useEffect(() => {
    if (open) {
      reset(editServer
        ? { name: editServer.name, url: editServer.url, authType: editServer.authType, username: editServer.username || '', clientId: editServer.clientId || '', clientSecret: editServer.clientSecret || '', hasQidoSupport: editServer.hasQidoSupport, hasWadoSupport: editServer.hasWadoSupport, hasStowSupport: editServer.hasStowSupport }
        : { name: '', url: '', authType: 'none' as const, username: '', clientId: '', clientSecret: '', hasQidoSupport: true, hasWadoSupport: true, hasStowSupport: true });
    }
  }, [open, editServer, reset]);

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => reset(), 200);
  };

  const onSubmit = (values: ServerFormValues) => {
    onSave(values);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editServer ? t('dicomweb.editTitle') : t('dicomweb.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('dicomweb.addDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="srv-name">{t('dicomweb.serverName')}</Label>
            <Input id="srv-name" placeholder={t('dicomweb.serverNamePlaceholder')} {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{t('dicomweb.validation.required')}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="srv-url">{t('dicomweb.serverUrl')}</Label>
            <Input id="srv-url" placeholder={t('dicomweb.serverUrlPlaceholder')} className="font-mono" {...register('url')} />
            {errors.url && (
              <p className="text-xs text-destructive">
                {errors.url.message === 'urlInvalid'
                  ? t('dicomweb.validation.urlInvalid')
                  : t('dicomweb.validation.required')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('dicomweb.authentication')}</Label>
            <Select value={authType} onValueChange={(v) => setValue('authType', v as 'none' | 'basic' | 'bearer' | 'oauth')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('dicomweb.authNone')}</SelectItem>
                <SelectItem value="basic">{t('dicomweb.authBasic')}</SelectItem>
                <SelectItem value="bearer">{t('dicomweb.authBearer')}</SelectItem>
                <SelectItem value="oauth">{t('dicomweb.authOauth')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {authType === 'basic' && (
            <div className="space-y-2">
              <Label htmlFor="srv-user">{t('dicomweb.username')}</Label>
              <Input id="srv-user" placeholder={t('dicomweb.usernamePlaceholder')} {...register('username')} />
            </div>
          )}

          {authType === 'oauth' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="srv-client-id">{t('dicomweb.clientId')}</Label>
                <Input id="srv-client-id" placeholder={t('dicomweb.clientIdPlaceholder')} className="font-mono" {...register('clientId')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="srv-client-secret">{t('dicomweb.clientSecret')}</Label>
                <Input id="srv-client-secret" type="password" placeholder={t('dicomweb.clientSecretPlaceholder')} className="font-mono" {...register('clientSecret')} />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm">{t('dicomweb.capabilities')}</Label>
            <div className="space-y-2.5">
              <Controller
                name="hasQidoSupport"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">QIDO-RS</p>
                      <p className="text-xs text-muted-foreground">{t('dicomweb.qidoDesc')}</p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
              <Controller
                name="hasWadoSupport"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">WADO-RS</p>
                      <p className="text-xs text-muted-foreground">{t('dicomweb.wadoDesc')}</p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
              <Controller
                name="hasStowSupport"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">STOW-RS</p>
                      <p className="text-xs text-muted-foreground">{t('dicomweb.stowDesc')}</p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>{t('common.cancel')}</Button>
            <Button type="submit">{editServer ? t('dicomweb.saveChanges') : t('dicomweb.addButton')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
