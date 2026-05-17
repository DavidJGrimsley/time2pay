import React from 'react';
import { PaymentsOverview } from '@/components/payments-overview';
import { TabScreenFrame } from '@/components/tab-screen-frame';

export default function PaymentsRoute() {
  return (
    <TabScreenFrame>
      <PaymentsOverview />
    </TabScreenFrame>
  );
}
