import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { NumberField } from '../../src/features/input-steps/NumberField';

describe('NumberField', () => {
  afterEach(cleanup);

  it('accepts decimal input like 0.875 (iPhone) and reports the number', () => {
    const onChange = vi.fn();
    const { container } = render(<NumberField value={null} onChange={onChange} />);
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: '0.875' } });
    expect(onChange).toHaveBeenLastCalledWith(0.875);
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });

  it('keeps a trailing dot in the text while typing', () => {
    const onChange = vi.fn();
    const { container } = render(<NumberField value={null} onChange={onChange} />);
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0.' } });
    expect(input.value).toBe('0.'); // 途中状態を保持
  });

  it('can be cleared to empty (Backspace) and reports null without re-injecting a default', () => {
    const onChange = vi.fn();
    const { container } = render(<NumberField value={55} onChange={onChange} />);
    const input = container.querySelector('input') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(input.value).toBe(''); // 即座にデフォルトを再注入しない
  });
});
