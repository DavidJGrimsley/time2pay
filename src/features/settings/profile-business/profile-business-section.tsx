import { Pressable, Text, TextInput, View } from 'react-native';
import { InlineNotice } from '@/components/inline-notice';
import { useProfileBusinessSection } from './profile-business-logic';

type ProfileBusinessSectionProps = {
  onProfileUpdated?: () => void;
};

export function ProfileBusinessSection({ onProfileUpdated }: ProfileBusinessSectionProps) {
  const {
    isLoading,
    isSavingBusiness,
    status,
    companyName,
    setCompanyName,
    logoUrl,
    setLogoUrl,
    fullName,
    setFullName,
    businessPhone,
    phoneError,
    businessEmail,
    setBusinessEmail,
    handleBusinessPhoneChange,
    handleBusinessPhoneBlur,
    handleSaveBusiness,
  } = useProfileBusinessSection(onProfileUpdated);

  return (
    <View className="gap-3">
      <TextInput
        value={companyName}
        onChangeText={setCompanyName}
        placeholder="Company name (optional)"
        className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
      />
      <TextInput
        value={logoUrl}
        onChangeText={setLogoUrl}
        placeholder="Logo URL (optional)"
        autoCapitalize="none"
        autoCorrect={false}
        className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
      />
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full name"
        className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
      />
      <TextInput
        value={businessPhone}
        onChangeText={handleBusinessPhoneChange}
        onBlur={handleBusinessPhoneBlur}
        placeholder="555-867-5309"
        keyboardType="phone-pad"
        className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
      />
      {phoneError ? <Text className="text-xs text-danger">{phoneError}</Text> : null}
      <TextInput
        value={businessEmail}
        onChangeText={setBusinessEmail}
        placeholder="Email address"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
      />
      <Pressable
        className="rounded-md bg-secondary px-4 py-2"
        onPress={handleSaveBusiness}
        disabled={isSavingBusiness || isLoading}
      >
        <Text className="text-center font-semibold text-white">
          {isSavingBusiness ? 'Saving...' : 'Save Business Settings'}
        </Text>
      </Pressable>
      {status ? <InlineNotice tone={status.tone} message={status.message} /> : null}
    </View>
  );
}
