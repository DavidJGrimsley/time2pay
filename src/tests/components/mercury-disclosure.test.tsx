import React from 'react';
import renderer from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

function makeComponent(name: string) {
  function Component({ children, ...props }: { children?: React.ReactNode }) {
    return React.createElement(name, props, children);
  }
  Component.displayName = name;
  return Component;
}

vi.mock('react-native', () => ({
  Image: makeComponent('Image'),
  Text: makeComponent('Text'),
  View: makeComponent('View'),
}));

describe('MercuryDisclosure', () => {
  it('renders the compact marked branding and matching business-account footer', async () => {
    const { MercuryDisclosure, MercuryPoweredBy, MERCURY_BUSINESS_BANKING_DISCLOSURE } = await import(
      '@/components/mercury-disclosure'
    );
    const instanceRef: { current: renderer.ReactTestRenderer | null } = { current: null };
    await renderer.act(async () => {
      instanceRef.current = renderer.create(
        <>
          <MercuryPoweredBy />
          <MercuryDisclosure />
        </>,
      );
    });
    if (!instanceRef.current) {
      throw new Error('Mercury disclosure did not render');
    }
    const root = instanceRef.current.root;

    expect(root.findByProps({ testID: 'mercury-disclosure' })).toBeTruthy();
    expect(root.findByProps({ testID: 'mercury-powered-by' })).toBeTruthy();
    expect(root.findByProps({ accessibilityLabel: 'Mercury logo' })).toBeTruthy();
    expect(
      root.find(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' && node.props.children === 'Powered by Mercury*',
      ),
    ).toBeTruthy();
    expect(
      root.find(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' &&
          Array.isArray(node.props.children) &&
          node.props.children.join('') === `* ${MERCURY_BUSINESS_BANKING_DISCLOSURE}`,
      ),
    ).toBeTruthy();
  });
});
