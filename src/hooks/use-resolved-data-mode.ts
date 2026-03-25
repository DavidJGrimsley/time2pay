import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getDataMode, type Time2PayDataMode } from '@/services/runtime-mode';

let cachedWebMode: Time2PayDataMode | null = null;

type ResolvedDataMode = {
  dataMode: Time2PayDataMode | null;
  hostedMode: boolean;
  resolved: boolean;
};

export function useResolvedDataMode(): ResolvedDataMode {
  const [dataMode, setDataMode] = useState<Time2PayDataMode | null>(() => {
    if (Platform.OS !== 'web') {
      return getDataMode();
    }

    return cachedWebMode;
  });

  useEffect(() => {
    const nextMode = getDataMode();

    if (Platform.OS === 'web') {
      cachedWebMode = nextMode;
    }

    setDataMode(nextMode);
  }, []);

  return {
    dataMode,
    hostedMode: dataMode === 'hosted',
    resolved: dataMode !== null,
  };
}
