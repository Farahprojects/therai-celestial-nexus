
export interface FontDefinition {
  name: string;
  value: string;
  class: string;
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting';
  googleFontUrl?: string;
  fallback: string;
  weights?: string[];
}

export const FONT_REGISTRY: FontDefinition[] = [
  // Sans-serif fonts
  {
    name: 'Inter',
    value: 'font-inter',
    class: 'font-inter',
    category: 'sans-serif',
    fallback: 'sans-serif',
    weights: ['300', '400', '500', '600', '700']
  },
  {
    name: 'Roboto',
    value: 'font-roboto',
    class: 'font-roboto',
    category: 'sans-serif',
    fallback: 'sans-serif',
    weights: ['300', '400', '500', '700']
  },
  {
    name: 'Open Sans',
    value: 'font-opensans',
    class: 'font-opensans',
    category: 'sans-serif',
    fallback: 'sans-serif',
    weights: ['300', '400', '500', '600', '700']
  },
  {
    name: 'Lato',
    value: 'font-lato',
    class: 'font-lato',
    category: 'sans-serif',
    fallback: 'sans-serif',
    weights: ['300', '400', '700']
  },
  {
    name: 'Montserrat',
    value: 'font-montserrat',
    class: 'font-montserrat',
    category: 'sans-serif',
    fallback: 'sans-serif',
    weights: ['300', '400', '500', '600', '700']
  },
  {
    name: 'Poppins',
    value: 'font-poppins',
    class: 'font-poppins',
    category: 'sans-serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
    fallback: 'sans-serif',
    weights: ['300', '400', '500', '600', '700']
  },
  
  // Serif fonts
  {
    name: 'GT Sectra',
    value: 'font-gt-sectra',
    class: 'font-gt-sectra',
    category: 'serif',
    fallback: 'serif',
    weights: ['400', '500', '700']
  },
  {
    name: 'Playfair Display',
    value: 'font-playfair',
    class: 'font-playfair',
    category: 'serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
    fallback: 'serif',
    weights: ['400', '500', '600', '700']
  },
  {
    name: 'Merriweather',
    value: 'font-merriweather',
    class: 'font-merriweather',
    category: 'serif',
    googleFontUrl: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap',
    fallback: 'serif',
    weights: ['300', '400', '700']
  }
];

export const getFontByValue = (value: string): FontDefinition | undefined => {
  return FONT_REGISTRY.find(font => font.value === value);
};

export const getFontsByCategory = (category: FontDefinition['category']): FontDefinition[] => {
  return FONT_REGISTRY.filter(font => font.category === category);
};

export const getGoogleFontsUrls = (): string[] => {
  return FONT_REGISTRY
    .filter(font => font.googleFontUrl)
    .map(font => font.googleFontUrl!);
};

export const getFontStyleByName = (styleName: string): FontDefinition => {
  const styleMap: Record<string, string> = {
    'modern': 'font-inter',
    'elegant': 'font-playfair',
    'bold': 'font-montserrat',
    'handwritten': 'font-poppins',
    'classic': 'font-gt-sectra',
    'minimal': 'font-lato'
  };
  
  const fontValue = styleMap[styleName] || 'font-inter';
  return getFontByValue(fontValue) || FONT_REGISTRY[0];
};
