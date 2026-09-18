import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OperationsEditor } from './OperationsEditor';
import type { TransformOperation } from '@/api/broker';
import '@/i18n';

/** The editor is controlled — the harness keeps the state like the page does. */
function Harness({ initial }: { initial: TransformOperation[] }) {
  const [operations, setOperations] = useState(initial);
  return <OperationsEditor operations={operations} onChange={setOperations} />;
}

describe('OperationsEditor', () => {
  it('flags a tag that is neither a DICOM tag nor a keyword', async () => {
    render(<Harness initial={[{ op: 'set', tag: '', value: '' }]} />);

    fireEvent.change(screen.getByLabelText(/tag/i), { target: { value: '0010-0010' } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/DICOM tag or keyword/i);
    expect(screen.getByLabelText(/tag/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('accepts a tag in the (gggg,eeee) form and a keyword', () => {
    const { rerender } = render(<Harness initial={[{ op: 'set', tag: '(0010,0010)', value: 'x' }]} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(<Harness initial={[{ op: 'set', tag: 'PatientName', value: 'x' }]} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
