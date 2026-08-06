import type { PropsWithChildren } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { Link, type Href } from 'expo-router';
import { CosmosLoadingAnimation } from '@/components/UI/Loading';
import { useMercuryKeyStatus } from '@/hooks/use-mercury-key-status';

const MERCURY_NAVY = '#272735';
const MERCURY_SOFT = '#eef2f7';
const MERCURY_LINE = '#dce2ea';
const MERCURY_LOGO_ICON = '/mercury-brand-kit/mercury-brand-kit/mercury_logo_icon.png';

function MercuryBlockedCard({
  title,
  message,
  ctaLabel,
  ctaHref,
  ctaExternalUrl,
}: {
  title: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaExternalUrl?: string;
}) {
  const ctaButton =
    ctaLabel && (ctaHref || ctaExternalUrl) ? (
      <Pressable
        style={{
          alignSelf: 'flex-start',
          borderRadius: 8,
          backgroundColor: MERCURY_NAVY,
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
        onPress={ctaExternalUrl ? () => Linking.openURL(ctaExternalUrl) : undefined}
      >
        <Text style={{ fontWeight: '600', color: '#ffffff', fontSize: 13 }}>{ctaLabel}</Text>
      </Pressable>
    ) : null;

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: MERCURY_LINE,
        backgroundColor: MERCURY_SOFT,
        padding: 20,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Image
          source={{ uri: MERCURY_LOGO_ICON }}
          style={{ width: 24, height: 24 }}
          resizeMode="contain"
          accessibilityLabel="Mercury"
        />
        <Text style={{ fontSize: 16, fontWeight: '700', color: MERCURY_NAVY }}>{title}</Text>
      </View>
      <Text style={{ fontSize: 13, lineHeight: 20, color: '#4a4a6a' }}>{message}</Text>
      {ctaHref && ctaLabel ? (
        <Link href={ctaHref as Href} asChild>
          {ctaButton}
        </Link>
      ) : (
        ctaButton
      )}
    </View>
  );
}

type MercuryKeyGateProps = PropsWithChildren<{
  requireArAccess?: boolean;
}>;

export function MercuryKeyGate({ children, requireArAccess = false }: MercuryKeyGateProps) {
  const { isLoading, accessMode, configured, arAccessAvailable, requiresSignIn } =
    useMercuryKeyStatus();

  if (isLoading || accessMode === null) {
    return (
      <View
        style={{
          alignItems: 'center',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: MERCURY_LINE,
          backgroundColor: MERCURY_SOFT,
          gap: 8,
          padding: 20,
        }}
      >
        <CosmosLoadingAnimation size={56} />
        <Text style={{ fontSize: 13, color: '#4a4a6a' }}>Checking Mercury connection...</Text>
      </View>
    );
  }

  if (accessMode === 'local') {
    return (
      <MercuryBlockedCard
        title="Hosted mode required"
        message="Mercury features use your saved API key from your hosted profile. Switch to hosted mode or use tour mode for a sandbox preview."
      />
    );
  }

  if (requiresSignIn) {
    return (
      <MercuryBlockedCard
        title="Sign in required"
        message="Sign in to use Mercury banking and payment features with your saved API key."
        ctaLabel="Sign In"
        ctaHref="/sign-in"
      />
    );
  }

  if (!configured) {
    return (
      <MercuryBlockedCard
        title="Mercury not connected"
        message="Save your Mercury production API key in Settings to unlock banking and payment features."
        ctaLabel="Open Settings"
        ctaHref="/settings"
      />
    );
  }

  // Default-deny the AR-gated UI: invoicing is opt-in. The user enables it
  // from their profile only after confirming they have a Mercury Plus or
  // higher plan. We can't auto-detect the plan tier reliably, so the user
  // is the source of truth.
  if (requireArAccess && arAccessAvailable !== true) {
    return (
      <MercuryBlockedCard
        title="Mercury invoicing requires Plus plan"
        message="Mercury invoicing (the AR API) is only available on Mercury Plus or higher. If you have a Plus plan, open Settings and click 'Enable Mercury Invoicing' to turn it on."
        ctaLabel="Open Settings"
        ctaHref="/settings"
      />
    );
  }

  return <>{children}</>;
}
