import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import { signInWithGitHubOAuth, signInWithMagicLink } from '@/services/supabase-client';

type StatusNotice = {
  message: string;
  tone: NoticeTone;
};

type HostedAuthGateProps = {
  onTourExperience?: () => void;
};

export function HostedAuthGate({ onTourExperience }: HostedAuthGateProps) {
  const [email, setEmail] = useState('');
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [isGitHubRedirecting, setIsGitHubRedirecting] = useState(false);
  const [status, setStatus] = useState<StatusNotice | null>(null);

  async function handleMagicLinkSignIn(): Promise<void> {
    setIsSendingMagicLink(true);
    setStatus(null);

    try {
      await signInWithMagicLink(email);
      setStatus({
        tone: 'success',
        message: 'Magic link sent. Check your inbox and open the link to continue.',
      });
    } catch (error: unknown) {
      setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to send magic link.',
      });
    } finally {
      setIsSendingMagicLink(false);
    }
  }

  async function handleGitHubSignIn(): Promise<void> {
    setIsGitHubRedirecting(true);
    setStatus(null);

    try {
      await signInWithGitHubOAuth();
    } catch (error: unknown) {
      setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to start GitHub OAuth.',
      });
      setIsGitHubRedirecting(false);
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="w-full max-w-xl gap-4 rounded-2xl bg-card p-6">
        <Text className="text-3xl font-extrabold text-heading">Sign in to Time2Pay</Text>
        <Text className="text-sm text-muted">
          Hosted mode requires authentication. Use email magic link or GitHub to continue.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@company.com"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />

        <Pressable
          className="rounded-md bg-secondary px-4 py-2"
          onPress={() => {
            handleMagicLinkSignIn().catch(() => undefined);
          }}
          disabled={isSendingMagicLink || isGitHubRedirecting}
        >
          <Text className="text-center font-semibold text-white">
            {isSendingMagicLink ? 'Sending magic link...' : 'Send magic link'}
          </Text>
        </Pressable>

        <Pressable
          className="rounded-md border border-border px-4 py-2"
          onPress={() => {
            handleGitHubSignIn().catch(() => undefined);
          }}
          disabled={isSendingMagicLink || isGitHubRedirecting}
        >
          <Text className="text-center font-semibold text-heading">
            {isGitHubRedirecting ? 'Redirecting to GitHub...' : 'Continue with GitHub'}
          </Text>
        </Pressable>

        {status ? <InlineNotice tone={status.tone} message={status.message} /> : null}

        {onTourExperience ? (
          <View className="mt-2 gap-2 border-t border-border pt-3">
            <Text className="text-xs text-muted">
              Not ready to sign in yet?
            </Text>
            <Pressable
              className="rounded-md border border-border bg-background px-4 py-2"
              onPress={onTourExperience}
              disabled={isSendingMagicLink || isGitHubRedirecting}
            >
              <Text className="text-center font-semibold text-heading">Tour the Experience</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}
