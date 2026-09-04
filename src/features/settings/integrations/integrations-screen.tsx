import { useState } from 'react';
import { Octicons } from '@expo/vector-icons';
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { InlineNotice } from '@/components/inline-notice';
import { readTrimmedPublicRuntimeConfigValue } from '@/services/runtime-config';
import { useIntegrationsScreen } from './integrations-logic';
import { GITHUB_PAT_CREATE_URL, GITHUB_PAT_DOCS_URL } from './github-oauth-shared';

const DEFAULT_MERCURY_ALLOWLIST_IP = '108.175.12.95';

function ServerIpCopyRow() {
  const [copied, setCopied] = useState(false);
  const serverIp =
    readTrimmedPublicRuntimeConfigValue('EXPO_PUBLIC_MERCURY_ALLOWLIST_IP') ||
    DEFAULT_MERCURY_ALLOWLIST_IP;

  function handleCopy(): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(serverIp)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
        .catch(() => undefined);
    }
  }

  return (
    <View className="flex-row items-center gap-2">
      <Text selectable className="text-sm font-semibold text-heading" style={{ fontFamily: 'Menlo' }}>
        {serverIp}
      </Text>
      <Pressable
        onPress={handleCopy}
        className={
          copied
            ? 'rounded border border-success/40 bg-success/15 px-2 py-0.5'
            : 'rounded border border-border bg-card px-2 py-0.5'
        }
      >
        <Text className={copied ? 'text-xs font-semibold text-success' : 'text-xs font-semibold text-muted'}>
          {copied ? 'Copied!' : 'Copy'}
        </Text>
      </Pressable>
    </View>
  );
}

export function IntegrationsScreen() {
  const {
    isLoading,
    isSavingIntegrations,
    generalStatus,
    githubStatus,
    mercuryStatus,
    tourModeEnabled,
    shouldShowHostedMercuryCredentials,
    githubPat,
    setGithubPat,
    showAdvancedGitHubOptions,
    setShowAdvancedGitHubOptions,
    showPatInfoModal,
    setShowPatInfoModal,
    isSigningInWithGitHub,
    isGitHubOAuthEnabled,
    hasGitHubRepoAccess,
    shouldShowManualGitHubSyncButton,
    mercuryApiKey,
    setMercuryApiKey,
    mercuryCredentialStatus,
    isSavingMercuryKey,
    isTestingMercuryKey,
    isTogglingMercuryAr,
    isDeletingMercuryKey,
    openExternalUrl,
    startGitHubOAuth,
    handleSaveIntegrations,
    handleSaveMercuryKey,
    handleTestMercuryKey,
    handleToggleMercuryArAccess,
    handleDeleteMercuryKey,
  } = useIntegrationsScreen();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-3 p-6"
    >
      <Text className="text-3xl font-extrabold text-heading">Integrations</Text>
      <Text className="text-muted">
        Connect GitHub for repository lookups and Mercury for banking, invoicing, and referrals.
      </Text>
      {generalStatus ? <InlineNotice tone={generalStatus.tone} message={generalStatus.message} /> : null}

      <View testID="github-integration-card" className="gap-3 rounded-xl bg-card p-4">
        <Text className="text-xl font-bold text-heading">GitHub</Text>
        <Text className="text-sm text-muted">
          GitHub access is for repository and commit lookup only. It does not auto-fill your
          personal profile name or email.
        </Text>
        {isGitHubOAuthEnabled ? (
          <Pressable
            className={`self-start rounded-full border px-4 py-2 ${isSigningInWithGitHub ? 'opacity-70' : ''}`}
            style={
              hasGitHubRepoAccess
                ? { borderColor: '#15803d', backgroundColor: '#166534' }
                : { borderColor: '#ffffff', backgroundColor: '#24292f' }
            }
            onPress={shouldShowManualGitHubSyncButton ? startGitHubOAuth : undefined}
            disabled={isSigningInWithGitHub || !shouldShowManualGitHubSyncButton}
          >
            <View className="flex-row items-center gap-2">
              <Octicons name="mark-github" size={16} color="#ffffff" />
              <Text className="font-semibold" style={{ color: '#ffffff' }}>
                {isSigningInWithGitHub ? 'Redirecting to GitHub...' : 'Sync repositories from GitHub'}
              </Text>
              {hasGitHubRepoAccess ? (
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: 18, height: 18, backgroundColor: '#22c55e' }}
                >
                  <Text className="text-xs font-bold" style={{ color: '#052e16' }}>
                    ✓
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        ) : null}
        <Pressable
          className="flex-row items-center justify-between rounded-md border border-border bg-background px-3 py-2"
          onPress={() => setShowAdvancedGitHubOptions(!showAdvancedGitHubOptions)}
        >
          <Text className="font-semibold text-heading">Advanced GitHub token options</Text>
          <Text className="text-sm font-semibold text-secondary">
            {showAdvancedGitHubOptions ? 'Hide' : 'Show'}
          </Text>
        </Pressable>
        {showAdvancedGitHubOptions ? (
          <View className="gap-2 rounded-md border border-border bg-background p-3">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm text-muted">
                Optional. Save a PAT if you want a manual GitHub token on this profile or need repo
                access outside the current GitHub sign-in session.
              </Text>
              <Pressable
                className="h-7 w-7 items-center justify-center rounded-full border border-border bg-card"
                onPress={() => setShowPatInfoModal(true)}
              >
                <Text className="text-sm font-bold text-heading">i</Text>
              </Pressable>
            </View>
            <Pressable
              className="self-start rounded-full border px-4 py-2"
              style={{ borderColor: '#d0d7de', backgroundColor: '#f6f8fa' }}
              onPress={() => openExternalUrl(GITHUB_PAT_CREATE_URL, { authRelated: true })}
            >
              <View className="flex-row items-center gap-2">
                <Octicons name="mark-github" size={16} color="#24292f" />
                <Text className="font-semibold" style={{ color: '#24292f' }}>
                  Create GitHub PAT
                </Text>
              </View>
            </Pressable>
            <TextInput
              value={githubPat}
              onChangeText={setGithubPat}
              placeholder="GitHub access token or PAT (optional)"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
            />
            <Pressable
              className="rounded-md bg-secondary px-4 py-2"
              onPress={handleSaveIntegrations}
              disabled={isSavingIntegrations || isLoading}
            >
              <Text className="text-center font-semibold text-white">
                {isSavingIntegrations ? 'Saving...' : 'Save Integrations'}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {githubStatus ? <InlineNotice tone={githubStatus.tone} message={githubStatus.message} /> : null}
      </View>

      {shouldShowHostedMercuryCredentials || tourModeEnabled ? (
        <View testID="mercury-integration-card" className="gap-3 rounded-xl bg-card p-4">
          <Text className="text-xl font-bold text-heading">Mercury</Text>
          {shouldShowHostedMercuryCredentials ? (
            <View className="gap-2.5 rounded-md border border-border bg-background p-3">
              <View className="flex-row items-center gap-2">
                <Image
                  source={{ uri: '/mercury-brand-kit/mercury-brand-kit/mercury_logo_icon.png' }}
                  style={{ width: 20, height: 20 }}
                  resizeMode="contain"
                  accessibilityLabel="Mercury"
                />
                <Text className="text-sm font-semibold text-heading">Mercury production API key</Text>
                {mercuryCredentialStatus?.configured ? (
                  <View className="ml-auto rounded-full bg-success/15 px-2 py-0.5">
                    <Text className="text-xs font-bold text-success">Connected</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-sm text-muted">
                {mercuryCredentialStatus?.configured
                  ? `Saved key ending in ${mercuryCredentialStatus.keyLastFour ?? '....'}.`
                  : 'No Mercury production key is saved for this hosted profile.'}
              </Text>
              <TextInput
                value={mercuryApiKey}
                onChangeText={setMercuryApiKey}
                placeholder="Mercury production API key"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
              />
              <Text className="text-xs leading-5 text-muted">
                Add it in Mercury: Settings → Tokens → your token → IP allowlist.
              </Text>
              <View className="gap-1">
                <Text className="text-xs font-bold text-heading">
                  How to get a Mercury API key (business accounts only):
                </Text>
                <Text className="text-xs text-muted">
                  In Mercury, go to All Settings → API → Tokens → Create an API token, then:
                </Text>
                <Text className="text-xs text-muted">1. Set a Nickname (e.g. &ldquo;Time2Pay&rdquo;).</Text>
                <Text className="text-xs text-muted">2. Permissions: pick one of these.</Text>
                <View className="gap-1 pl-3">
                  <Text className="text-xs font-semibold text-heading">A. Custom Scopes (recommended)</Text>
                  <Text className="text-xs text-muted">
                    Least privilege — limits damage if the token is ever exposed. Check exactly these
                    scopes:
                  </Text>
                  <View className="gap-0.5 pl-3">
                    <Text className="text-xs text-muted">• Fetch Depository Accounts</Text>
                    <Text className="text-xs text-muted">• Fetch Recipients</Text>
                    <Text className="text-xs text-muted">• Create Recipients *</Text>
                    <Text className="text-xs text-muted">• Edit Recipients *</Text>
                    <Text className="text-xs text-muted">• Send Money *</Text>
                    <Text className="text-xs text-muted">• Fetch Invoices (Mercury Plus only)</Text>
                    <Text className="text-xs text-muted">• Modify Invoices * (Mercury Plus only)</Text>
                  </View>
                </View>
                <View className="gap-1 pl-3">
                  <Text className="text-xs font-semibold text-heading">B. Read and Write (easier)</Text>
                  <Text className="text-xs text-muted">
                    One click. Works fine, just grants more access than Time2Pay needs. &ldquo;Read
                    Only&rdquo; will not work.
                  </Text>
                </View>
                <Text className="text-xs text-muted">
                  3. IP whitelist: paste this server&apos;s IP. Mercury requires an allowed IP for any
                  token with write access.
                </Text>
                <ServerIpCopyRow />
                <Text className="text-xs text-muted">
                  4. Click Create token, copy the value Mercury shows, and paste it above.
                </Text>
                <Text className="text-xs text-muted">
                  (Mercury Plus required for invoicing. If you&apos;re on a lower tier, the Mercury
                  Invoice Builder will be blocked but everything else works.)
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                <Pressable
                  className="rounded-md bg-heading px-4 py-2"
                  style={{ opacity: isSavingMercuryKey || isLoading ? 0.6 : 1 }}
                  onPress={handleSaveMercuryKey}
                  disabled={isSavingMercuryKey || isLoading}
                >
                  <Text className="text-sm font-semibold text-background">
                    {isSavingMercuryKey ? 'Saving...' : 'Save Mercury Key'}
                  </Text>
                </Pressable>
                <Pressable
                  className="rounded-md border border-border bg-card px-4 py-2"
                  style={{ opacity: isTestingMercuryKey || !mercuryCredentialStatus?.configured ? 0.5 : 1 }}
                  onPress={handleTestMercuryKey}
                  disabled={isTestingMercuryKey || !mercuryCredentialStatus?.configured}
                >
                  <Text className="text-sm font-semibold text-heading">
                    {isTestingMercuryKey ? 'Testing...' : 'Test Key'}
                  </Text>
                </Pressable>
                <Pressable
                  className={
                    mercuryCredentialStatus?.arAccessAvailable === true
                      ? 'rounded-md border border-border bg-card px-4 py-2'
                      : 'rounded-md bg-heading px-4 py-2'
                  }
                  style={{ opacity: isTogglingMercuryAr || !mercuryCredentialStatus?.configured ? 0.5 : 1 }}
                  onPress={() => handleToggleMercuryArAccess(mercuryCredentialStatus?.arAccessAvailable !== true)}
                  disabled={isTogglingMercuryAr || !mercuryCredentialStatus?.configured}
                >
                  <Text
                    className={
                      mercuryCredentialStatus?.arAccessAvailable === true
                        ? 'text-sm font-semibold text-heading'
                        : 'text-sm font-semibold text-background'
                    }
                  >
                    {isTogglingMercuryAr
                      ? 'Updating...'
                      : mercuryCredentialStatus?.arAccessAvailable === true
                        ? 'Disable Mercury Invoicing'
                        : 'Enable Mercury Invoicing (Plus plan)'}
                  </Text>
                </Pressable>
                {mercuryCredentialStatus?.configured ? (
                  <Pressable
                    className="rounded-md border border-danger px-4 py-2"
                    onPress={handleDeleteMercuryKey}
                    disabled={isDeletingMercuryKey}
                  >
                    <Text className="text-center font-semibold text-danger">
                      {isDeletingMercuryKey ? 'Deleting...' : 'Delete Key'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
          {tourModeEnabled ? (
            <InlineNotice
              tone="neutral"
              message="Tour mode uses Mercury sandbox credentials. Sign in to save your own production Mercury API key."
            />
          ) : null}
          {mercuryStatus ? (
            <InlineNotice tone={mercuryStatus.tone} message={mercuryStatus.message} />
          ) : null}
        </View>
      ) : null}

      <Modal
        visible={showPatInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPatInfoModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/55 px-4">
          <View className="w-full max-w-lg rounded-xl bg-card p-4">
            <Text className="text-lg font-bold text-heading">GitHub PAT Help</Text>
            <ScrollView
              className="mt-3"
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <Text className="text-sm leading-6 text-muted">
                A Personal Access Token (PAT) is a secret key from your GitHub account. This app
                uses it only to authenticate GitHub API calls so commit/branch lookups are more
                reliable and less likely to hit public rate limits.
              </Text>
              <Text className="mt-3 text-sm font-semibold text-heading">What it does here</Text>
              <Text className="mt-1 text-sm leading-6 text-muted">
                Increases GitHub API rate limit from 60 to 5,000 requests/hour and improves
                commit/branch fetch success.
              </Text>
              <Text className="mt-3 text-sm font-semibold text-heading">Where to create it</Text>
              <Text className="mt-1 text-sm leading-6 text-muted">
                GitHub Settings / Developer settings / Personal access tokens. Use the button below
                to open the creation page.
              </Text>
              <Text className="mt-3 text-sm font-semibold text-heading">Recommended scope</Text>
              <Text className="mt-1 text-sm leading-6 text-muted">
                For private-repo commit lookups, set repository Contents to Read-only (Metadata
                Read-only stays enabled by default). Do not grant more permissions than needed.
              </Text>
            </ScrollView>
            <View className="mt-3 gap-2">
              <Pressable
                className="rounded-md bg-secondary px-3 py-2"
                onPress={() => openExternalUrl(GITHUB_PAT_CREATE_URL, { authRelated: true })}
              >
                <Text className="text-center font-semibold text-white">Open PAT Creation Page</Text>
              </Pressable>
              <Pressable
                className="rounded-md border border-border px-3 py-2"
                onPress={() => openExternalUrl(GITHUB_PAT_DOCS_URL, { authRelated: true })}
              >
                <Text className="text-center font-semibold text-heading">Open PAT Docs</Text>
              </Pressable>
              <Pressable
                className="rounded-md border border-border px-3 py-2"
                onPress={() => setShowPatInfoModal(false)}
              >
                <Text className="text-center font-semibold text-heading">Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
