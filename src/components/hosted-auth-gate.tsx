import { Octicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import { logRuntimeDiagnostic } from '@/services/runtime-diagnostics';
import { signInWithGitHubOAuth, signInWithMagicLink } from '@/services/supabase-client';

type StatusNotice = {
  message: string;
  tone: NoticeTone;
};

type HostedAuthGateProps = {
  description?: string;
  githubLabel?: string;
  githubPendingLabel?: string;
  magicLinkLabel?: string;
  magicLinkPendingLabel?: string;
  onTourExperience?: () => void;
  redirectPath?: string;
  shouldCreateUser?: boolean;
  title?: string;
};

export function HostedAuthGate({
  description = 'Enter your email to sign in. If this is your first time, Time2Pay will create your account from the same secure link.',
  githubLabel = 'Continue with GitHub',
  githubPendingLabel = 'Redirecting to GitHub...',
  magicLinkLabel = 'Send magic link',
  magicLinkPendingLabel = 'Sending magic link...',
  onTourExperience,
  redirectPath = '/dashboard',
  shouldCreateUser = true,
  title = 'Sign in or create your Time2Pay account',
}: HostedAuthGateProps) {
  const [email, setEmail] = useState('');
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [isGitHubRedirecting, setIsGitHubRedirecting] = useState(false);
  const [status, setStatus] = useState<StatusNotice | null>(null);
  const isWebGitHubOAuthAvailable = Platform.OS === 'web';

  async function handleMagicLinkSignIn(): Promise<void> {
    setIsSendingMagicLink(true);
    setStatus(null);
    logRuntimeDiagnostic('hostedAuth.magicLink.start', {
      hasEmailInput: Boolean(email.trim()),
    });

    try {
      await signInWithMagicLink(email, {
        redirectPath,
        shouldCreateUser,
      });
      logRuntimeDiagnostic('hostedAuth.magicLink.success');
      setStatus({
        tone: 'success',
        message: 'Magic link sent. Check your inbox and open the link to continue.',
      });
    } catch (error: unknown) {
      logRuntimeDiagnostic(
        'hostedAuth.magicLink.error',
        {
          error,
        },
        { level: 'error' },
      );
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
    logRuntimeDiagnostic('hostedAuth.github.start');

    try {
      await signInWithGitHubOAuth({ redirectPath });
    } catch (error: unknown) {
      logRuntimeDiagnostic(
        'hostedAuth.github.error',
        {
          error,
        },
        { level: 'error' },
      );
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
        <Text className="text-3xl font-extrabold text-heading">{title}</Text>
        <Text className="text-sm text-muted">{description}</Text>

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
          className="self-center rounded-full bg-secondary px-6 py-2"
          onPress={() => {
            handleMagicLinkSignIn().catch(() => undefined);
          }}
          disabled={isSendingMagicLink || isGitHubRedirecting}
        >
          <Text className="text-center font-semibold text-white">
            {isSendingMagicLink ? magicLinkPendingLabel : magicLinkLabel}
          </Text>
        </Pressable>

        {isWebGitHubOAuthAvailable ? (
          <Pressable
            className="self-center rounded-full border px-4 py-2"
            style={{ borderColor: '#ffffff', backgroundColor: '#24292f' }}
            onPress={() => {
              handleGitHubSignIn().catch(() => undefined);
            }}
            disabled={isSendingMagicLink || isGitHubRedirecting}
          >
            <View className="flex-row items-center gap-2">
              <Octicons name="mark-github" size={16} color="#ffffff" />
              <Text className="font-semibold" style={{ color: '#ffffff' }}>
                {isGitHubRedirecting ? githubPendingLabel : githubLabel}
              </Text>
            </View>
          </Pressable>
        ) : (
          <InlineNotice
            tone="neutral"
            message="GitHub sign-in is web-only for now. In Expo Go/native, use the magic link flow instead."
          />
        )}

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
