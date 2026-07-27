import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { InlineNotice } from '@/components/inline-notice';

type EmbeddedBillingCheckoutProps = {
  clientSecret: string;
  onClose: () => void;
  onComplete: () => void;
};

const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function EmbeddedBillingCheckout({
  clientSecret,
  onClose,
  onComplete,
}: EmbeddedBillingCheckoutProps) {
  const options = useMemo(
    () => ({
      clientSecret,
      onComplete,
    }),
    [clientSecret, onComplete],
  );

  if (!stripePromise) {
    return (
      <InlineNotice
        tone="error"
        message="Embedded checkout is not configured. Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY and restart the app."
      />
    );
  }

  return (
    <View className="gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 md:p-6">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="gap-1">
          <Text className="text-lg font-bold text-heading">Secure checkout</Text>
          <Text className="text-sm text-muted">
            Complete your purchase here. Payment details go directly to Stripe.
          </Text>
        </View>
        <Pressable
          className="rounded-md border border-border px-4 py-2"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close checkout"
        >
          <Text className="font-semibold text-heading">Close</Text>
        </Pressable>
      </View>
      <View className="overflow-hidden rounded-xl bg-white">
        <EmbeddedCheckoutProvider
          key={clientSecret}
          stripe={stripePromise}
          options={options}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </View>
    </View>
  );
}
