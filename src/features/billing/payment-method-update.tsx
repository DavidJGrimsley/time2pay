type PaymentMethodUpdateProps = {
  clientSecret: string;
  onCancel: () => void;
  onComplete: (paymentMethodId: string) => Promise<void>;
};

export function PaymentMethodUpdate(_props: PaymentMethodUpdateProps) {
  return null;
}
