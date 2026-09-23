import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NodeFormDialog } from './NodeFormDialog';
import '@/i18n';

const SOURCE = {
  id: 1, name: 'ris-a', aet: 'RIS_A', host: '10.0.1.20', port: 104,
  calling_aet: 'MWLBROKER', charset: 'ISO_IR 100', enabled: true, timeout_s: 10,
  priority: 10, cache_stale_on_error: true, cache_refresh_s: 0,
  tls: false, tls_verify: true,
  strip_query_retrieve_level: false, created_at: '2026-09-18T00:00:00Z',
};

describe('discard guard', () => {
  it('closes immediately when nothing was changed', () => {
    const onOpenChange = vi.fn();
    render(
      <NodeFormDialog kind="source" open onOpenChange={onOpenChange} pending={false}
                      onSubmit={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText(/discard your input/i)).not.toBeInTheDocument();
  });

  it('asks before throwing away an edited form', async () => {
    const onOpenChange = vi.fn();
    render(
      <NodeFormDialog kind="source" open onOpenChange={onOpenChange} pending={false}
                      onSubmit={vi.fn()} initial={SOURCE} />,
    );

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'ris-a-edited' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // the dialog stays open and a confirmation appears
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(await screen.findByText(/discard your input/i)).toBeInTheDocument();

    // "keep editing" returns to the form
    fireEvent.click(screen.getByRole('button', { name: /keep editing/i }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('discards on confirmation', async () => {
    const onOpenChange = vi.fn();
    render(
      <NodeFormDialog kind="source" open onOpenChange={onOpenChange} pending={false}
                      onSubmit={vi.fn()} initial={SOURCE} />,
    );

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^discard$/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('warns when another node already uses the AE title', async () => {
    render(
      <NodeFormDialog kind="source" open onOpenChange={vi.fn()} pending={false}
                      onSubmit={vi.fn()} siblings={[SOURCE]} />,
    );

    fireEvent.change(screen.getByLabelText(/^ae title$/i), { target: { value: 'RIS_A' } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/already used by ris-a/i);
  });
});
