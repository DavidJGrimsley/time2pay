import { Redirect, type Href } from 'expo-router';

export const PAYMENTS_REDIRECT_HREF = {
  pathname: '/mercury',
  params: { section: 'payments' },
} as const satisfies Href;

export default function PaymentsRedirect() {
  return <Redirect href={PAYMENTS_REDIRECT_HREF} />;
}
