import { useEffect, useRef, type PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type AnimatedSizeViewProps = PropsWithChildren<{
  expanded?: boolean;
  duration?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
}>;

export function AnimatedSizeView({
  children,
  expanded = true,
  duration = 260,
  className,
  style,
  onLayout,
}: AnimatedSizeViewProps) {
  const reducedMotion = useReducedMotion();
  const measuredHeight = useSharedValue(0);
  const animatedHeight = useSharedValue(0);
  const hasMeasured = useRef(false);

  function handleContentLayout(event: LayoutChangeEvent): void {
    const nextHeight = event.nativeEvent.layout.height;
    measuredHeight.set(nextHeight);
    if (!hasMeasured.current || reducedMotion) {
      animatedHeight.set(expanded ? nextHeight : 0);
      hasMeasured.current = true;
    } else {
      animatedHeight.set(withTiming(expanded ? nextHeight : 0, { duration }));
    }
    onLayout?.(event);
  }

  useEffect(() => {
    const nextHeight = expanded ? measuredHeight.get() : 0;
    if (!hasMeasured.current || reducedMotion) {
      animatedHeight.set(nextHeight);
      return;
    }
    animatedHeight.set(withTiming(nextHeight, { duration }));
  }, [animatedHeight, duration, expanded, measuredHeight, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.get(),
    overflow: 'hidden',
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      <View className={className} onLayout={handleContentLayout}>
        {children}
      </View>
    </Animated.View>
  );
}
