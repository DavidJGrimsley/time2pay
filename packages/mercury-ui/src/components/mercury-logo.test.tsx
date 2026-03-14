import { act, create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { MercuryLogo } from './mercury-logo';

describe('MercuryLogo', () => {
  it('renders the selected logo variant', () => {
    let rendered!: ReturnType<typeof create>;

    act(() => {
      rendered = create(<MercuryLogo variant="icon" size={32} />);
    });

    expect(rendered.toJSON()).toBeTruthy();
  });
});
