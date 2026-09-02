import Constants from 'expo-constants';
import { type Href, Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { InlineNotice } from '@/components/inline-notice';
import { CollapsibleSection } from './collapsible-section';
import { ProfileBusinessSection } from './profile-business/profile-business-section';
import { DataBackupSection } from './data-backup/data-backup-section';
import { PreferencesSection } from './preferences/preferences-section';
import { ReferralsSection } from './referrals/referrals-section';
import { useSettingsScreen } from './settings-screen-logic';

const APP_VERSION = Constants.expoConfig?.version ?? '—';

export function SettingsScreen() {
  const {
    isProfileIncomplete,
    refreshProfileCompletion,
    bumpDataVersion,
    dataVersion,
    generalStatus,
    isSigningOut,
    showSignOut,
    handleSignOut,
  } = useSettingsScreen();

  function handleDataRestored(): void {
    refreshProfileCompletion();
    bumpDataVersion();
  }

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Settings</Text>
      <Text className="text-muted">
        Manage your account details, integrations, billing access, and local backup tools.
      </Text>
      {generalStatus ? <InlineNotice tone={generalStatus.tone} message={generalStatus.message} /> : null}
      {isProfileIncomplete ? (
        <InlineNotice
          tone="neutral"
          message="Add your name, phone, and email in Your Business below to start tracking time and invoicing."
        />
      ) : null}

      <Link href={'/settings/billing' as Href} asChild>
        <Pressable className="flex-row items-center justify-between gap-3 rounded-xl bg-card p-4">
          <View className="gap-1">
            <Text className="text-xl font-bold text-heading">Billing</Text>
            <Text className="text-sm text-muted">Manage your plan, payment method, and invoices.</Text>
          </View>
          <Text className="text-sm font-semibold text-secondary">Open →</Text>
        </Pressable>
      </Link>

      <CollapsibleSection
        title="Your Business"
        description="Company, contact, and profile details."
        defaultExpanded={isProfileIncomplete}
      >
        <ProfileBusinessSection key={dataVersion} onProfileUpdated={refreshProfileCompletion} />
      </CollapsibleSection>

      <Link href={'/settings/integrations' as Href} asChild>
        <Pressable className="flex-row items-center justify-between gap-3 rounded-xl bg-card p-4">
          <View className="gap-1">
            <Text className="text-xl font-bold text-heading">Integrations</Text>
            <Text className="text-sm text-muted">Connect GitHub repositories and your Mercury account.</Text>
          </View>
          <Text className="text-sm font-semibold text-secondary">Open →</Text>
        </Pressable>
      </Link>

      <CollapsibleSection title="Referrals" description="Mercury referral status and rewards.">
        <ReferralsSection key={dataVersion} />
      </CollapsibleSection>

      <CollapsibleSection title="Data & Backup" description="Export or restore your local data.">
        <DataBackupSection onDataRestored={handleDataRestored} />
      </CollapsibleSection>

      <CollapsibleSection title="Preferences" description="Appearance and other app-wide settings.">
        <PreferencesSection />
      </CollapsibleSection>

      <View className="gap-3 rounded-xl bg-card p-4">
        <Text className="text-xl font-bold text-heading">Legal</Text>
        <View className="flex-row flex-wrap gap-2">
          <Link href={'/terms' as Href} asChild>
            <Pressable className="rounded-md border border-border px-3 py-1.5">
              <Text className="text-sm font-semibold text-heading">Terms of Service</Text>
            </Pressable>
          </Link>
          <Link href={'/privacy' as Href} asChild>
            <Pressable className="rounded-md border border-border px-3 py-1.5">
              <Text className="text-sm font-semibold text-heading">Privacy Policy</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {showSignOut ? (
        <View className="items-end pt-2">
          <Pressable
            className={`rounded-md border border-danger px-4 py-2 ${isSigningOut ? 'opacity-70' : ''}`}
            onPress={handleSignOut}
            disabled={isSigningOut}
          >
            <Text className="text-center font-semibold text-danger">
              {isSigningOut ? 'Signing out...' : 'Sign Out'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Text className="pt-2 text-center text-xs text-muted">Time2Pay v{APP_VERSION}</Text>
    </View>
  );
}
