import { useEffect, useState } from 'react';
import { getDataMode, type Time2PayDataMode } from '@/services/runtime-mode';

type ResolvedDataMode = {
  dataMode: Time2PayDataMode;
  hostedMode: boolean;
  resolved: boolean;
};

export function useResolvedDataMode(): ResolvedDataMode {
  const [dataMode, setDataMode] = useState<Time2PayDataMode>(() => getDataMode());

  useEffect(() => {
    const nextMode = getDataMode();
    setDataMode((currentMode) => (currentMode === nextMode ? currentMode : nextMode));
  }, []);

  return {
    dataMode,
    hostedMode: dataMode === 'hosted',
    resolved: true,
  };
}
