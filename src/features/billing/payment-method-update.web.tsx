import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useMemo, useState } from 'react';
import { Pressable, Text, View, useColorScheme } from 'react-native';
import { InlineNotice } from '@/components/inline-notice';

type PaymentMethodUpdateProps = {
  clientSecret: string;
  onCancel: () => void;
  onComplete: (paymentMethodId: string) => Promise<void>;
};

const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function PaymentMethodUpdateForm({ onCancel, onComplete }: Omit<PaymentMethodUpdateProps, 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (!stripe || !elements) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await stripe.confirmSetup({ elements, redirect: 'if_required' });
      if (result.error) {
        throw new Error(result.error.message ?? 'Stripe could not save this payment method.');
      }

      const paymentMethod = result.setupIntent?.payment_method;
      const paymentMethodId =
        typeof paymentMethod === 'string' ? paymentMethod : paymentMethod?.id ?? null;
      if (!paymentMethodId) {
        throw new Error('Stripe did not return a saved payment method. Please try again.');
      }

      await onComplete(paymentMethodId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to update payment method.');
      setIsSubmitting(false);
    }
  }

  return (
    <View className="gap-4 rounded-xl border border-border bg-card p-4">
      <View className="gap-1">
        <Text className="text-lg font-bold text-heading">Update payment method</Text>
        <Text className="text-sm text-muted">
          Your payment details go directly to Stripe. Time2Pay never receives the full card number.
        </Text>
      </View>
      <View className="rounded-lg bg-white p-3">
        <PaymentElement options={{ layout: 'tabs' }} />
      </View>
      {error ? <InlineNotice tone="error" message={error} /> : null}
      <View className="flex-row flex-wrap gap-2">
        <Pressable
          className="rounded-md border border-border px-4 py-2"
          onPress={onCancel}
          disabled={isSubmitting}
          accessibilityRole="button"
        >
          <Text className="font-semibold text-heading">Cancel</Text>
        </Pressable>
        <Pressable
          className="rounded-md bg-secondary px-4 py-2"
          onPress={() => {
            submit().catch(() => undefined);
          }}
          disabled={!stripe || !elements || isSubmitting}
          accessibilityRole="button"
        >
          <Text className="font-semibold text-white">
            {isSubmitting ? 'Saving payment method...' : 'Save payment method'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function PaymentMethodUpdate({ clientSecret, onCancel, onComplete }: PaymentMethodUpdateProps) {
  const colorScheme = useColorScheme();
  const options = useMemo(
    () => ({
      clientSecret,
      appearance: {
        theme: colorScheme === 'dark' ? ('night' as const) : ('stripe' as const),
        variables:
          colorScheme === 'dark'
            ? {
                colorBackground: '#24291f',
                colorPrimary: '#d4955f',
                colorText: '#f8f7f3',
                borderRadius: '8px',
              }
            : { colorPrimary: '#1a1f16', borderRadius: '8px' },
      },
    }),
    [clientSecret, colorScheme],
  );

  if (!stripePromise) {
    return (
      <InlineNotice
        tone="error"
        message="Payment-method updates are not configured. Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY and restart the app."
      />
    );
  }

  return (
    <Elements key={clientSecret} stripe={stripePromise} options={options}>
      <PaymentMethodUpdateForm onCancel={onCancel} onComplete={onComplete} />
    </Elements>
  );
}
