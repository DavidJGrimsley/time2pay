import { act, create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { MercuryStatusNotice } from './mercury-status-notice';

describe('MercuryStatusNotice', () => {
  it('renders non-empty messages', () => {
    let rendered!: ReturnType<typeof create>;

    act(() => {
      rendered = create(<MercuryStatusNotice message="Connected" tone="success" />);
    });

    expect(JSON.stringify(rendered.toJSON())).toContain('Connected');
  });
});
