import React from 'react';
import { BankOverview } from '@/components/bank-overview';
import { TabScreenFrame } from '@/components/tab-screen-frame';

export default function BankRoute() {
  return (
    <TabScreenFrame>
      <BankOverview />
    </TabScreenFrame>
  );
}
