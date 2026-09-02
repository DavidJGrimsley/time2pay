import { useEffect, useState } from 'react';
import { type Href, Link } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { getMercuryReferralStatus, type MercuryReferralStatus } from '@/services/mercury-referrals';
import { isHostedMode } from '@/services/runtime-mode';
import { useAuthUiStore } from '@/stores/auth-ui-store';

export function ReferralsSection() {
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const shouldShowHostedMercuryCredentials = isHostedMode() && isAuthenticated && !tourModeEnabled;
  const [mercuryReferralStatus, setMercuryReferralStatus] = useState<MercuryReferralStatus | null>(null);

  useEffect(() => {
    if (!shouldShowHostedMercuryCredentials) {
      setMercuryReferralStatus(null);
      return;
    }

    getMercuryReferralStatus()
      .then(setMercuryReferralStatus)
      .catch((error: unknown) => {
        setMercuryReferralStatus(null);
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn('Failed to load Mercury referral status:', error);
        }
      });
  }, [shouldShowHostedMercuryCredentials]);

  if (!shouldShowHostedMercuryCredentials) {
    return (
      <Text className="text-sm text-muted">
        Sign in to a hosted account to view your Mercury referral status.
      </Text>
    );
  }

  return (
    <View className="gap-2.5 rounded-md border border-border bg-background p-3">
      <View className="flex-row items-center gap-2">
        <Image
          source={{ uri: '/mercury-brand-kit/mercury-brand-kit/mercury_logo_icon.png' }}
          style={{ width: 20, height: 20 }}
          resizeMode="contain"
          accessibilityLabel="Mercury"
        />
        <Text className="text-sm font-semibold text-heading">Mercury referral reward</Text>
        {mercuryReferralStatus?.premiumAccess ? (
          <View className="ml-auto rounded-full bg-success/15 px-2 py-0.5">
            <Text className="text-xs font-bold text-success">Active</Text>
          </View>
        ) : null}
      </View>
      <Text className="text-sm text-muted">
        {mercuryReferralStatus?.premiumAccess
          ? `Premium access granted${
              mercuryReferralStatus.premiumAccessGrantedAt
                ? ` on ${new Date(mercuryReferralStatus.premiumAccessGrantedAt).toLocaleDateString()}`
                : ''
            }.`
          : 'Referral attribution and qualification reporting are being connected with Mercury.'}
      </Text>
      <Pressable
        className="self-start rounded-md border border-border px-4 py-2 opacity-65"
        disabled
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
      >
        <Text className="text-sm font-semibold text-muted">Mercury reward — Coming soon</Text>
      </Pressable>
      <View className="flex-row flex-wrap gap-2">
        <Link href={'/settings/billing' as Href} asChild>
          <Pressable className="rounded-md border border-border px-3 py-1.5">
            <Text className="text-sm font-semibold text-heading">Billing</Text>
          </Pressable>
        </Link>
        <Link href={'/referral-status' as Href} asChild>
          <Pressable className="rounded-md border border-border px-3 py-1.5">
            <Text className="text-sm font-semibold text-heading">Referral Status</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
