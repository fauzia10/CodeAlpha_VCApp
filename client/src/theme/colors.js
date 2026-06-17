// Premium Rose/Baby Pink Dual Mode UI Color Palette
export const getColors = (mode) => {
  if (mode === 'light') {
    return {
      primary: '#ec4899',       // Vibrant Pink
      primaryDark: '#db2777',   // Darker pink
      secondary: '#f472b6',     // Soft Baby Pink
      background: '#fff1f2',    // Pastel rose-white background
      surface: '#ffffff',       // Pure white cards
      surfaceLight: '#ffe4e6',  // Soft pink input
      text: '#4c0519',          // Deep rose-maroon text
      textMuted: '#9f1239',     // Slate-pink text
      border: '#fecdd3',        // Soft pink borders
      error: '#ef4444',
      success: '#10b981',
      warning: '#f59e0b',
      white: '#ffffff',
      black: '#000000',
      transparent: 'transparent',
    };
  }

  // Dark Mode (Midnight Rose / Deep Plum)
  return {
    primary: '#f472b6',       // Baby Pink Accent
    primaryDark: '#ec4899',   // Vibrant Rose
    secondary: '#fb7185',     // Pastel Rose
    background: '#180f15',    // Deep plum black background
    surface: '#261521',       // Midnight rose container
    surfaceLight: '#3d1f34',  // Medium plum input
    text: '#ffe4e6',          // Rose pink light text
    textMuted: '#fda4af',     // Muted rose text
    border: '#4c243c',        // Dark rose border lines
    error: '#f43f5e',
    success: '#34d399',
    warning: '#fbbf24',
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
  };
};

// Default Static Fallback (Dark Baby Pink Theme)
export const COLORS = getColors('dark');
