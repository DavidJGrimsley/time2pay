import React from 'react';
import renderer from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { LandingHeader } from '@/components/landing/landing-header';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', async () => {
  const ReactModule = await import('react');

  function makeComponent(name: string) {
    return ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactModule.createElement(name, props, children);
  }

  return {
    Pressable: makeComponent('Pressable'),
    Text: makeComponent('Text'),
    View: makeComponent('View'),
  };
});

vi.mock('@/components/landing/semantic-elements', async () => {
  const ReactModule = await import('react');
  return {
    SemanticView: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactModule.createElement('SemanticView', props, children),
  };
});

describe('LandingHeader', () => {
  it('keeps sign-in in the top nav and removes get started', async () => {
    const instanceRef: { current: renderer.ReactTestRenderer | null } = { current: null };

    await renderer.act(async () => {
      instanceRef.current = renderer.create(
        <LandingHeader
          onOpenSignIn={() => undefined}
          onTourExperience={() => undefined}
        />,
      );
    });

    const tree = instanceRef.current?.toJSON();
    const rendered = JSON.stringify(tree);

    expect(rendered).toContain('Sign In');
    expect(rendered).toContain('Tour the App');
    expect(rendered).not.toContain('Get Started');
  });
});
