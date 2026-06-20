// Premium Baby Pink Dual Mode UI Color Palette
export const getColors = (mode) => {
  if (mode === 'light') {
    return {
      primary: '#F7B6C8',       // Baby Pink
      primaryDark: '#E989A6',   // Accent Rose
      secondary: '#FCE7EF',     // Soft Blush
      background: '#ffffff',    // Clean white
      surface: '#Fdf2f5',       // Very soft pink surface
      surfaceLight: '#ffffff',  // White inputs
      text: '#3D2630',          // Dark text
      textMuted: '#8b6f7a',     // Muted dark pinkish-grey
      border: '#f8d0dc',        // Soft pink borders
      error: '#ef4444',
      success: '#10b981',
      warning: '#f59e0b',
      white: '#ffffff',
      black: '#000000',
      transparent: 'transparent',
    };
  }

  // Dark Mode (Dark Rose/Plum)
  return {
    primary: '#E989A6',       // Accent Rose
    primaryDark: '#F7B6C8',   // Baby Pink (inverted for dark mode)
    secondary: '#8a4c60',     // Dark Blush
    background: '#1A1114',    // Deep dark brown-plum
    surface: '#291b21',       // Dark surface container
    surfaceLight: '#3D2630',  // Muted plum input
    text: '#FCE7EF',          // Soft blush text
    textMuted: '#c5aeb7',     // Muted light text
    border: '#4a323c',        // Dark borders
    error: '#f43f5e',
    success: '#34d399',
    warning: '#fbbf24',
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
  };
};

// Default Static Fallback (Light Theme as requested for clean branding)
export const COLORS = getColors('light');

