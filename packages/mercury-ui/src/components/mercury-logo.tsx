import { Image, View } from 'react-native';
import mercuryLogoHorizontal from '../../assets/brand/mercury_logo_horizontal.png';
import mercuryLogoIcon from '../../assets/brand/mercury_logo_icon.png';
import mercuryLogoVertical from '../../assets/brand/mercury_logo_vertical.png';

type MercuryLogoVariant = 'horizontal' | 'vertical' | 'icon';

type MercuryLogoProps = {
  variant?: MercuryLogoVariant;
  size?: number;
  framed?: boolean;
  framePadding?: number;
  frameRadius?: number;
  frameColor?: string;
};

const logoSourceByVariant = {
  horizontal: mercuryLogoHorizontal,
  vertical: mercuryLogoVertical,
  icon: mercuryLogoIcon,
} as const;

const ratioByVariant = {
  horizontal: { width: 4.2, height: 1 },
  vertical: { width: 1.4, height: 1 },
  icon: { width: 1, height: 1 },
} as const;

export function MercuryLogo({
  variant = 'horizontal',
  size = 132,
  framed = false,
  framePadding = 12,
  frameRadius = 16,
  frameColor = '#ffffff',
}: MercuryLogoProps) {
  const ratio = ratioByVariant[variant];
  const height = variant === 'horizontal' ? size / ratio.width : size;
  const width = variant === 'horizontal' ? size : size * ratio.width;

  const imageNode = (
    <Image
      source={logoSourceByVariant[variant]}
      style={{ width, height, resizeMode: 'contain' }}
    />
  );

  if (!framed) {
    return imageNode;
  }

  return (
    <View style={{ padding: framePadding, backgroundColor: frameColor, borderRadius: frameRadius }}>
      {imageNode}
    </View>
  );
}
