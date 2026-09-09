import { Image, Text, View } from 'react-native';

export const MERCURY_BUSINESS_BANKING_DISCLOSURE =
  'Mercury is a fintech company, not an FDIC-insured bank. Banking services provided through Choice Financial Group and Column N.A., Members FDIC.';

export const MERCURY_AFFILIATE_LINK_DISCLOSURE =
  'Time2Pay may earn a commission from approved Mercury applications received through the “Sign Up Through Time2Pay” link.';

const MERCURY_LOGO_ICON = '/mercury-brand-kit/mercury-brand-kit/mercury_logo_icon.png';

export function MercuryPoweredBy() {
  return (
    <View
      testID="mercury-powered-by"
      accessibilityLabel="Powered by Mercury. See the marked business banking disclosure below."
      className="flex-row items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5"
    >
      <View style={{ backgroundColor: '#ffffff', borderRadius: 4, padding: 1.5 }}>
        <Image
          source={{ uri: MERCURY_LOGO_ICON }}
          style={{ width: 16, height: 16 }}
          resizeMode="contain"
          accessibilityLabel="Mercury logo"
        />
      </View>
      <Text className="text-xs font-semibold text-heading">
        Powered by Mercury*
      </Text>
    </View>
  );
}

export function MercuryDisclosure() {
  return (
    <Text
      testID="mercury-disclosure"
      selectable
      className="text-xs leading-5 text-muted"
    >
      * {MERCURY_BUSINESS_BANKING_DISCLOSURE}
    </Text>
  );
}
