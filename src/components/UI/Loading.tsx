import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';

type LoadingComponentProps = {
  label?: string;
  size?: number;
};

type CosmosLoadingAnimationProps = {
  size?: number;
};

export function CosmosLoadingAnimation({ size = 180 }: CosmosLoadingAnimationProps) {
  return (
    <View style={[styles.animationFrame, { width: size }]}>
      <LottieView
        source={require('../../../assets/lottie/Loading_Cosmos.json')}
        autoPlay
        loop
        enableMergePathsAndroidForKitKatAndAbove
        resizeMode="contain"
        style={styles.animation}
      />
    </View>
  );
}

export function LoadingComponent({ label, size }: LoadingComponentProps) {
  return (
    <View
      accessibilityLabel={label ?? 'Loading'}
      accessibilityRole="progressbar"
      className="w-full items-center justify-center py-10"
    >
      <CosmosLoadingAnimation size={size} />
      {label ? <Text className="mt-2 text-center text-muted">{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  animation: {
    height: '100%',
    width: '100%',
  },
  animationFrame: {
    aspectRatio: 1,
    width: 180,
  },
});
