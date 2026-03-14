import React from 'react';

function createHostComponent(name: string) {
  const HostComponent = ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement(name, props, children);
  HostComponent.displayName = name;
  return HostComponent;
}

export const View = createHostComponent('View');
export const Text = createHostComponent('Text');
export const Pressable = createHostComponent('Pressable');
export const TextInput = createHostComponent('TextInput');
export const ScrollView = createHostComponent('ScrollView');
export const Image = createHostComponent('Image');
export const StyleSheet = {
  create: <T,>(styles: T) => styles,
  hairlineWidth: 1,
};
export const useWindowDimensions = () => ({ width: 1024, height: 768, scale: 1, fontScale: 1 });
export const useColorScheme = () => 'light';
export type StyleProp<T> = T | T[] | null | undefined;
export type ViewStyle = Record<string, unknown>;
export type TextStyle = Record<string, unknown>;
export type ImageStyle = Record<string, unknown>;
