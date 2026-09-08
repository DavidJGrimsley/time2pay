import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const cancelAnimationMock = vi.hoisted(() => vi.fn());

function makeComponent(name: string) {
  function Component({ children, ...props }: { children?: React.ReactNode }) {
    return React.createElement(name, props, children);
  }
  Component.displayName = name;
  return Component;
}

vi.mock('react-native-svg', () => ({
  __esModule: true,
  default: makeComponent('Svg'),
  Circle: makeComponent('Circle'),
  ClipPath: makeComponent('ClipPath'),
  Defs: makeComponent('Defs'),
  Ellipse: makeComponent('Ellipse'),
  G: makeComponent('G'),
  Line: makeComponent('Line'),
  Path: makeComponent('Path'),
  Rect: makeComponent('Rect'),
  Text: makeComponent('SvgText'),
}));

vi.mock('react-native-reanimated', () => {
  const identity = (value: number) => value;

  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (Component: React.ComponentType<unknown>) => Component,
    },
    cancelAnimation: cancelAnimationMock,
    Easing: {
      bezier: () => identity,
      cubic: identity,
      in: (easing: (value: number) => number) => easing,
      linear: identity,
      quad: identity,
    },
    useAnimatedProps: (callback: () => unknown) => callback(),
    useReducedMotion: () => true,
    useSharedValue: (initialValue: number) => {
      const shared = {
        value: initialValue,
        get: () => shared.value,
        set: (nextValue: number) => {
          shared.value = nextValue;
        },
      };
      return shared;
    },
    withDelay: (_delay: number, value: number) => value,
    withRepeat: (value: number) => value,
    withSequence: (...values: number[]) => values.at(-1) ?? 0,
    withTiming: (value: number) => value,
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  cancelAnimationMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Time2PayLogo', () => {
  it('uses a unique dollar-fill clip path for every instance', async () => {
    const { Time2PayLogo } = await import('@/components/branding/time2pay-logo');
    let root!: renderer.ReactTestRenderer;

    await act(async () => {
      root = renderer.create(
        <>
          <Time2PayLogo testID="logo-one" />
          <Time2PayLogo testID="logo-two" />
        </>,
      );
    });

    const ids = root.root.findAll((node) => String(node.type) === 'ClipPath').map((node) => node.props.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('keeps its requested square size and accessible image label', async () => {
    const { Time2PayLogo } = await import('@/components/branding/time2pay-logo');
    let root!: renderer.ReactTestRenderer;

    await act(async () => {
      root = renderer.create(<Time2PayLogo size={160} accessibilityLabel="Time2Pay static mark" />);
    });

    const svg = root.root.find((node) => String(node.type) === 'Svg');
    expect(svg.props).toMatchObject({
      width: 160,
      height: 160,
      accessible: true,
      accessibilityRole: 'image',
      accessibilityLabel: 'Time2Pay static mark',
      pointerEvents: 'none',
    });
  });
});

describe('AnimatedTime2PayLogo', () => {
  it('finishes reduced-motion states and replays when replayKey changes', async () => {
    const { AnimatedTime2PayLogo } = await import('@/components/branding/animated-time2pay-logo');
    const onComplete = vi.fn();
    let root!: renderer.ReactTestRenderer;

    await act(async () => {
      root = renderer.create(
        <AnimatedTime2PayLogo state="alarm" motion="reduced" replayKey={0} onAnimationComplete={onComplete} />,
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(140);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenLastCalledWith('alarm');

    await act(async () => {
      root.update(
        <AnimatedTime2PayLogo state="alarm" motion="reduced" replayKey={1} onAnimationComplete={onComplete} />,
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(140);
    });
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('cancels pending loops when unmounted', async () => {
    const { AnimatedTime2PayLogo } = await import('@/components/branding/animated-time2pay-logo');
    let root!: renderer.ReactTestRenderer;

    await act(async () => {
      root = renderer.create(<AnimatedTime2PayLogo state="clocking-in" motion="full" />);
    });
    cancelAnimationMock.mockClear();

    await act(async () => {
      root.unmount();
    });
    expect(cancelAnimationMock).toHaveBeenCalled();
  });
});
