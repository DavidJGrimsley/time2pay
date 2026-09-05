import { Redirect, type Href } from 'expo-router';

export const BANK_REDIRECT_HREF = '/mercury' as const satisfies Href;

export default function BankRedirect() {
  return <Redirect href={BANK_REDIRECT_HREF} />;
}
