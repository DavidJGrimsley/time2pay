export type StylistColorScheme = 'light' | 'dark';
export type StylistColorMode = 'bg' | 'automatic';
export type StylistFamilyMode = 'one' | 'two';

export interface StylistColorPalette {
  background: string;
  surface: string;
  text: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
}

export interface StylistSemanticFamilies {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
}

export interface StylistThemeTokens {
  version: 1;
  colorSystem: {
    mode: StylistColorMode;
    previewScheme: StylistColorScheme;
    familyMode: StylistFamilyMode;
  };
  families: {
    light: StylistSemanticFamilies;
    dark: StylistSemanticFamilies;
  };
  palettes: {
    bg: {
      light: StylistColorPalette;
      dark: StylistColorPalette;
    };
    automatic: {
      light: StylistColorPalette;
      dark: StylistColorPalette;
    };
  };
  colors: {
    light: StylistColorPalette;
    dark: StylistColorPalette;
  };
  typography: {
    fontFamily: string;
    fontDisplay: string;
    fontTitle: string;
    fontSubtitle: string;
    fontBody: string;
    fontCaption: string;
    fontMono: string;
    displaySize: number;
    headingSize: number;
    bodySize: number;
    captionSize: number;
  };
  layout: {
    radius: number;
    spacing: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
  };
}

export const stylistThemeTokens: StylistThemeTokens = {
  version: 1,
  colorSystem: {
    mode: 'bg',
    previewScheme: 'light',
    familyMode: 'one',
  },
  families: {
    light: {
      primary: 'sage',
      secondary: 'clay',
      success: 'leaf',
      warning: 'copper',
    },
    dark: {
      primary: 'sage',
      secondary: 'copper',
      success: 'leaf',
      warning: 'copper',
    },
  },
  palettes: {
    bg: {
      light: {
        background: '#f8f7f3',
        surface: '#f2f0ea',
        text: '#1a1f16',
        primary: '#AFE4B7',
        secondary: '#bb7e5d',
        success: '#4f8f58',
        warning: '#d4955f',
      },
      dark: {
        background: '#1a1f16',
        surface: '#24291f',
        text: '#f8f7f3',
        primary: '#8fd49a',
        secondary: '#d4955f',
        success: '#6aaf72',
        warning: '#d4955f',
      },
    },
    automatic: {
      light: {
        background: '#f8f7f3',
        surface: '#f2f0ea',
        text: '#1a1f16',
        primary: '#AFE4B7',
        secondary: '#bb7e5d',
        success: '#4f8f58',
        warning: '#d4955f',
      },
      dark: {
        background: '#1a1f16',
        surface: '#24291f',
        text: '#f8f7f3',
        primary: '#8fd49a',
        secondary: '#d4955f',
        success: '#6aaf72',
        warning: '#d4955f',
      },
    },
  },
  colors: {
    light: {
      background: '#f8f7f3',
      surface: '#f2f0ea',
      text: '#1a1f16',
      primary: '#AFE4B7',
      secondary: '#bb7e5d',
      success: '#4f8f58',
      warning: '#d4955f',
    },
    dark: {
      background: '#1a1f16',
      surface: '#24291f',
      text: '#f8f7f3',
      primary: '#8fd49a',
      secondary: '#d4955f',
      success: '#6aaf72',
      warning: '#d4955f',
    },
  },
  typography: {
    fontFamily: 'System',
    fontDisplay: 'System',
    fontTitle: 'System',
    fontSubtitle: 'System',
    fontBody: 'System',
    fontCaption: 'System',
    fontMono: 'monospace',
    displaySize: 32,
    headingSize: 20,
    bodySize: 15,
    captionSize: 12,
  },
  layout: {
    radius: 24,
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
  },
};

export default stylistThemeTokens;
