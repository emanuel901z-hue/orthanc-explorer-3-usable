/**
 * PageHelp — „Was ist das?" für jede Broker-Seite.
 *
 * A novice opens a page called "Routing rules" and has no idea what a rule does,
 * what the priority means or what happens if it is wrong. The help button
 * answers that in plain words: what the page is for, what to fill in, the
 * mistakes to avoid and how to check the result — without leaving the page.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function PageHelp({ helpId }: { helpId: string }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  // the visible chrome is translated into every language; the detailed help
  // bodies currently exist in German and English (English fills the rest)
  const detailedHelpInEnglish = !['en', 'de'].includes(i18n.resolvedLanguage ?? 'en');

  // every help text has: what it is / what to fill in / what goes wrong
  const sections: { heading: string; items: string[] }[] = [
    {
      heading: t('broker.helpWhat'),
      items: t(`broker.help_${helpId}_what`, { returnObjects: true, defaultValue: [] }) as string[],
    },
    {
      heading: t('broker.helpHow'),
      items: t(`broker.help_${helpId}_how`, { returnObjects: true, defaultValue: [] }) as string[],
    },
    {
      heading: t('broker.helpWrong'),
      items: t(`broker.help_${helpId}_wrong`, { returnObjects: true, defaultValue: [] }) as string[],
    },
  ].map((section) => ({
    ...section,
    items: Array.isArray(section.items) ? section.items : [],
  }));

  if (sections.every((section) => section.items.length === 0)) {
    return null;                                   // no help text for this page yet
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        data-testid="page-help"
        aria-label={t('broker.helpButton')}
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-4 w-4 mr-1" />
        {t('broker.helpButton')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="page-help-dialog">
          <DialogHeader>
            <DialogTitle>{t(`broker.help_${helpId}_title`, { defaultValue: t('broker.helpButton') })}</DialogTitle>
            <DialogDescription>{t('broker.helpIntro')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {sections.filter((section) => section.items.length > 0).map((section) => (
              <div key={section.heading} className="space-y-1">
                <p className="font-medium">{section.heading}</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ))}
            {detailedHelpInEnglish && (
              <p className="border-t pt-3 text-xs text-muted-foreground">
                {t('broker.i18nBrokerNote')}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
