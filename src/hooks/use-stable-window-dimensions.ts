import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';

type StableWindowDimensionsOptions = {
  width?: number;
  height?: number;
};

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 900;

export function useStableWindowDimensions(
  options: StableWindowDimensionsOptions = {},
) {
  const { width, height, scale, fontScale } = useWindowDimensions();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return {
    width: hasMounted && width > 0 ? width : (options.width ?? DEFAULT_WIDTH),
    height: hasMounted && height > 0 ? height : (options.height ?? DEFAULT_HEIGHT),
    scale,
    fontScale,
  };
}
