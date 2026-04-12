import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DicomWebServer } from '@/shared/types';

const serverSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  url: z.string().trim().min(1, 'URL is required').url('Must be a valid URL'),
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
          <DialogTitle>{editServer ? 'Edit DICOMweb Server' : 'Add DICOMweb Server'}</DialogTitle>
          <DialogDescription>
            Configure a DICOMweb server for QIDO-RS, WADO-RS, and STOW-RS operations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="srv-name">Name</Label>
            <Input id="srv-name" placeholder="Cloud PACS" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="srv-url">Server URL</Label>
            <Input id="srv-url" placeholder="https://pacs.hospital.org/dicomweb" className="font-mono" {...register('url')} />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Authentication</Label>
            <Select value={authType} onValueChange={(v) => setValue('authType', v as 'none' | 'basic' | 'bearer' | 'oauth')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Authentication</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="oauth">OAuth 2.0</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {authType === 'basic' && (
            <div className="space-y-2">
              <Label htmlFor="srv-user">Username</Label>
              <Input id="srv-user" placeholder="username" {...register('username')} />
            </div>
          )}

          {authType === 'oauth' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="srv-client-id">Client ID</Label>
                <Input id="srv-client-id" placeholder="your-client-id" className="font-mono" {...register('clientId')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="srv-client-secret">Client Secret</Label>
                <Input id="srv-client-secret" type="password" placeholder="your-client-secret" className="font-mono" {...register('clientSecret')} />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm">Capabilities</Label>
            <div className="space-y-2.5">
              <Controller
                name="hasQidoSupport"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">QIDO-RS</p>
                      <p className="text-xs text-muted-foreground">Query/search for DICOM objects</p>
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
                      <p className="text-xs text-muted-foreground">Retrieve DICOM objects</p>
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
                      <p className="text-xs text-muted-foreground">Store/send DICOM objects</p>
                    </div>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit">{editServer ? 'Save Changes' : 'Add Server'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
