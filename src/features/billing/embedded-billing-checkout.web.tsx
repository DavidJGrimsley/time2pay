import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useMemo } from 'react';
import { View } from 'react-native';
import { InlineNotice } from '@/components/inline-notice';

type EmbeddedBillingCheckoutProps = {
  clientSecret: string;
  onClose?: () => void;
  onComplete: () => void;
};

const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function EmbeddedBillingCheckout({
  clientSecret,
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
    <View className="overflow-hidden rounded-[28px] border border-border bg-background p-3 md:p-5">
      <View className="overflow-hidden rounded-[24px] border border-border bg-card">
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
