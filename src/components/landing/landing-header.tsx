import { Pressable, Text, View } from 'react-native';
import { SemanticView } from './semantic-elements';

type LandingHeaderProps = {
  onOpenSignIn: () => void;
  onTourExperience: () => void;
};

export function LandingHeader({ onOpenSignIn, onTourExperience }: LandingHeaderProps) {
  return (
    <SemanticView
      as="header"
      className="border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md"
      style={{ boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)' }}
    >
      <View
        className="mx-auto w-full flex-row items-center justify-between gap-4"
        style={{ maxWidth: 1120 }}
      >
        <View className="gap-1">
          <Text className="text-lg font-bold text-heading md:text-xl">Time2Pay</Text>
          <Text className="text-xs uppercase tracking-[2px] text-muted">Time tracking for self-hosted billing</Text>
        </View>

        <View className="flex-row items-center gap-2">
          <Pressable
            className="rounded-full border border-border bg-background px-3 py-2"
            onPress={onTourExperience}
          >
            <Text className="text-sm font-semibold text-heading">Tour the App</Text>
          </Pressable>
          <Pressable className="rounded-full bg-primary px-3 py-2" onPress={onOpenSignIn}>
            <Text className="text-sm font-semibold text-heading">Sign In</Text>
          </Pressable>
        </View>
      </View>
    </SemanticView>
  );
}
