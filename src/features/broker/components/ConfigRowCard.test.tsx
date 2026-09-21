/**
 * The mobile card is the table row on small screens — it must behave the same:
 * a click (or Enter/Space) opens the edit dialog, the buttons inside do not.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigRowCard } from './ConfigRowCard';

function renderCard(onOpen = vi.fn()) {
  render(
    <ConfigRowCard
      title="ris-a"
      fields={[{ label: 'Host', value: 'mock-ris-a' }]}
      onOpen={onOpen}
      actions={<button type="button">Löschen</button>}
    />,
  );
  return onOpen;
}

describe('ConfigRowCard', () => {
  it('opens the edit dialog when the card is clicked', () => {
    const onOpen = renderCard();
    fireEvent.click(screen.getByText('ris-a'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('opens it with Enter and Space as well', () => {
    const onOpen = renderCard();
    const card = screen.getByTestId('config-row');

    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('does not swallow clicks on the action buttons', () => {
    const onOpen = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('is not clickable without an onOpen (read-only usage)', () => {
    render(<ConfigRowCard title="ris-a" fields={[]} />);
    const card = screen.getByTestId('config-row');
    expect(card.getAttribute('role')).toBeNull();
    expect(card.getAttribute('tabindex')).toBeNull();
  });
});
