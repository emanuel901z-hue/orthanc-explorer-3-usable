/**
 * PageHelp — „Was ist das?" für jede Seite.
 *
 * A novice opens a page called "Routing rules" and has no idea what a rule does,
 * what the priority means or what happens if it is wrong. The help button
 * answers that in plain words: what the page is for, what to fill in, the
 * mistakes to avoid and how to check the result — without leaving the page.
 *
 * `prefix` selects the translation section: the broker pages own
 * `broker.help_<id>_*`, the rest of the UI uses `help.help_<id>_*`. The wording
 * pattern is the same in both — what it is / how to work with it / what to do
 * when nothing arrives.
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

export function PageHelp({ helpId, prefix = 'broker' }: {
  helpId: string;
  prefix?: 'broker' | 'help';
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  // the visible chrome is translated into every language; the detailed help
  // bodies currently exist in German and English (English fills the rest)
  // a page rendered without the i18n setup must not crash — English is the fallback
  const detailedHelpInEnglish = !['en', 'de'].includes(i18n?.resolvedLanguage ?? 'en');

  // every help text has: what it is / what to fill in / what goes wrong
  const sections: { heading: string; items: string[] }[] = [
    {
      heading: t(`${prefix}.helpWhat`),
      items: t(`${prefix}.help_${helpId}_what`, { returnObjects: true, defaultValue: [] }) as string[],
    },
    {
      heading: t(`${prefix}.helpHow`),
      items: t(`${prefix}.help_${helpId}_how`, { returnObjects: true, defaultValue: [] }) as string[],
    },
    {
      heading: t(`${prefix}.helpWrong`),
      items: t(`${prefix}.help_${helpId}_wrong`, { returnObjects: true, defaultValue: [] }) as string[],
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
        aria-label={t(`${prefix}.helpButton`)}
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-4 w-4 mr-1" />
        {t(`${prefix}.helpButton`)}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="page-help-dialog">
          <DialogHeader>
            <DialogTitle>{t(`${prefix}.help_${helpId}_title`, { defaultValue: t(`${prefix}.helpButton`) })}</DialogTitle>
            <DialogDescription>{t(`${prefix}.helpIntro`)}</DialogDescription>
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
                {t(`${prefix}.i18nNote`)}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
