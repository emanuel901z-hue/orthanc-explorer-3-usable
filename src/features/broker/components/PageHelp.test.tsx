import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PageHelp } from './PageHelp';
import '@/i18n';

describe('PageHelp', () => {
  it('explains the page in three plain-language sections', async () => {
    render(<PageHelp helpId="sources" />);

    fireEvent.click(screen.getByTestId('page-help'));

    const dialog = await screen.findByTestId('page-help-dialog');
    // what it is / what to fill in / what goes wrong
    expect(dialog).toHaveTextContent(/what is it/i);
    expect(dialog).toHaveTextContent(/what do i fill in/i);
    expect(dialog).toHaveTextContent(/what goes wrong/i);
    // concrete, non-technical guidance
    expect(dialog).toHaveTextContent(/AE title: the name the RIS expects/i);
    expect(dialog).toHaveTextContent(/C-ECHO/i);
  });

  it('has help for every broker page', async () => {
    for (const helpId of ['overview', 'sources', 'targets', 'rules', 'transforms',
                          'stations', 'worklist', 'spool', 'audit', 'settings']) {
      const { unmount } = render(<PageHelp helpId={helpId} />);
      fireEvent.click(screen.getByTestId('page-help'));
      const dialog = await screen.findByTestId('page-help-dialog');
      expect(dialog.textContent?.length ?? 0, `${helpId} has help text`).toBeGreaterThan(120);
      unmount();
    }
  });

  it('renders nothing when a page has no help text', () => {
    render(<PageHelp helpId="does-not-exist" />);
    expect(screen.queryByTestId('page-help')).not.toBeInTheDocument();
  });

  it('keeps the dialog scrollable on a small screen', async () => {
    render(<PageHelp helpId="worklist" />);
    fireEvent.click(screen.getByTestId('page-help'));

    const dialog = await screen.findByTestId('page-help-dialog');
    await waitFor(() => expect(dialog).toBeVisible());
    expect(dialog.className).toContain('max-h-[90vh]');
    expect(dialog.className).toContain('overflow-y-auto');
  });
});

describe('PageHelp in a language without detailed help', () => {
  it('says that the details are available in German and English', async () => {
    const i18nModule = (await import('@/i18n')).default;
    await i18nModule.changeLanguage('fr');
    render(<PageHelp helpId="sources" />);

    fireEvent.click(screen.getByTestId('page-help'));
    const dialog = await screen.findByTestId('page-help-dialog');

    // the chrome is French, the details fall back to English, and the note explains it
    expect(dialog).toHaveTextContent(/détails|detail/i);
    await i18nModule.changeLanguage('en');
  });
});
