import { Octicons } from '@expo/vector-icons';
import { useState, type ComponentProps, type Ref } from 'react';
import { Pressable, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { tabFillRange } from '@/components/workspace-tab-highlight';
import { TAB_PILL } from '@/components/workspace-nav';

type IconName = ComponentProps<typeof Octicons>['name'];

export type WorkspaceTabPillProps = {
  enabled: SharedValue<number>;
  href?: string;
  icon: IconName;
  index: number;
  label: string;
  progress: SharedValue<number>;
  ref?: Ref<View>;
  selected?: boolean;
  children?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
};

export function WorkspaceTabPill({
  enabled,
  href: _href,
  icon,
  index,
  label,
  progress,
  ref,
  selected = false,
  children: _children,
  onPressIn,
  onPressOut,
  style,
  ...props
}: WorkspaceTabPillProps) {
  const { theme } = useUniwind();
  const palette = TAB_PILL[theme === 'dark' ? 'dark' : 'light'];
  const [pressed, setPressed] = useState(false);

  const fillStyle = useAnimatedStyle(() => {
    const { left, width } = tabFillRange(progress.get(), index, enabled.get());
    return {
      left: `${left * 100}%`,
      width: `${width * 100}%`,
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const { width } = tabFillRange(progress.get(), index, enabled.get());
    return { opacity: width };
  });

  const labelStyle = useAnimatedStyle(() => {
    const { width } = tabFillRange(progress.get(), index, enabled.get());
    return {
      color: interpolateColor(width, [0, 1], [palette.inactiveText, palette.activeText]),
    };
  });

  const inactiveIconStyle = useAnimatedStyle(() => {
    const { width } = tabFillRange(progress.get(), index, enabled.get());
    return { opacity: 1 - width };
  });

  const activeIconStyle = useAnimatedStyle(() => {
    const { width } = tabFillRange(progress.get(), index, enabled.get());
    return { opacity: width };
  });

  return (
    <Pressable
      {...props}
      ref={ref}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={8}
      pressRetentionOffset={12}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={[
        {
          borderRadius: 999,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          transitionProperty: 'transform',
          transitionDuration: '120ms',
          transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
        } as ViewStyle,
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: 999,
            boxShadow: palette.glow,
          },
          glowStyle,
        ]}
      />
      <View
        className="flex-row items-center gap-1.5 overflow-hidden rounded-full px-3.5 py-2"
        style={{ backgroundColor: palette.inactive }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              bottom: 0,
              backgroundColor: palette.active,
            },
            fillStyle,
          ]}
        />
        <View className="h-3.5 w-3.5 items-center justify-center">
          <Animated.View style={[{ position: 'absolute' }, inactiveIconStyle]}>
            <Octicons name={icon} size={14} color={palette.inactiveText} />
          </Animated.View>
          <Animated.View style={[{ position: 'absolute' }, activeIconStyle]}>
            <Octicons name={icon} size={14} color={palette.activeText} />
          </Animated.View>
        </View>
        <Animated.Text className="font-semibold" style={labelStyle}>
          {label}
        </Animated.Text>
      </View>
    </Pressable>
  );
}
