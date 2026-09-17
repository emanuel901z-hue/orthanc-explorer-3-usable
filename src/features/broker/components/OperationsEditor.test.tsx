import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OperationsEditor } from './OperationsEditor';
import type { TransformOperation } from '@/api/broker';
import '@/i18n';

function setup(operations: TransformOperation[]) {
  const onChange = vi.fn();
  render(<OperationsEditor operations={operations} onChange={onChange} />);
  return onChange;
}

describe('OperationsEditor', () => {
  it('shows the empty hint when there are no operations', () => {
    setup([]);
    expect(screen.getByText(/no operations yet/i)).toBeInTheDocument();
  });

  it('adds a new operation with the default op', () => {
    const onChange = setup([{ op: 'set', tag: 'PatientID', value: 'X' }]);
    fireEvent.click(screen.getByRole('button', { name: /add operation/i }));
    expect(onChange).toHaveBeenCalledWith([
      { op: 'set', tag: 'PatientID', value: 'X' },
      { op: 'set', tag: '', value: '' },
    ]);
  });

  it('removes the selected operation', () => {
    const onChange = setup([
      { op: 'set', tag: 'A', value: '1' },
      { op: 'remove', tag: 'B' },
    ]);
    fireEvent.click(screen.getAllByRole('button', { name: /remove operation/i })[0]);
    expect(onChange).toHaveBeenCalledWith([{ op: 'remove', tag: 'B' }]);
  });

  it('edits tag and value of an operation', () => {
    const onChange = setup([{ op: 'set', tag: '', value: '' }]);
    fireEvent.change(screen.getByLabelText('DICOM tag'), { target: { value: 'InstitutionName' } });
    expect(onChange).toHaveBeenCalledWith([{ op: 'set', tag: 'InstitutionName', value: '' }]);
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'Klinikum' } });
    expect(onChange).toHaveBeenCalledWith([{ op: 'set', tag: '', value: 'Klinikum' }]);
  });

  it('shows the from_tag field for copy operations', () => {
    const onChange = setup([
      { op: 'copy', tag: 'StudyDescription', from_tag: 'RequestedProcedureDescription' },
    ]);
    expect(screen.getByLabelText('Copy from tag')).toBeInTheDocument();
    expect(screen.queryByLabelText('Value')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Copy from tag'), {
      target: { value: 'SeriesDescription' },
    });
    expect(onChange).toHaveBeenCalledWith([
      { op: 'copy', tag: 'StudyDescription', from_tag: 'SeriesDescription' },
    ]);
  });

  it('hides value fields for remove operations', () => {
    setup([{ op: 'remove', tag: 'PatientAddress' }]);
    expect(screen.queryByLabelText('Value')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Copy from tag')).not.toBeInTheDocument();
  });

  it('shows the pattern field for replace operations', () => {
    setup([{ op: 'replace', tag: 'AccessionNumber', pattern: '^ALT', value: 'KH' }]);
    expect(screen.getByLabelText('Pattern (regex)')).toBeInTheDocument();
    expect(screen.getByLabelText('Value')).toBeInTheDocument();
  });
});
