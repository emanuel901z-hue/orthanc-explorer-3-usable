import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { SHORTCUTS, Shortcut } from '@/shared/hooks/use-keyboard-shortcuts';
import { Keyboard } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_LABELS: Record<Shortcut['category'], string> = {
  navigation: 'Navigation',
  actions: 'Actions',
  general: 'General',
};

const CATEGORY_ORDER: Shortcut['category'][] = ['navigation', 'actions', 'general'];

export function KeyboardShortcutsDialog({ open, onOpenChange }: Props) {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: SHORTCUTS.filter((s) => s.category === cat),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {grouped.map((group, gi) => (
            <div key={group.category}>
              {gi > 0 && <Separator className="mb-4" />}
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {group.label}
              </h4>
              <div className="space-y-2">
                {group.items.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-xs font-medium text-muted-foreground">
                      {shortcut.label}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2 border-t">
          Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">?</kbd> anywhere to toggle this dialog
        </p>
      </DialogContent>
    </Dialog>
  );
}
