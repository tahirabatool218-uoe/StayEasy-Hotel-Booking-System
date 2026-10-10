import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'stayeasy-theme';

// Matches --color-background in each theme (styles/variables.css). Keeps the
// mobile browser chrome in step with the page instead of staying navy.
const THEME_COLORS = { light: '#f8fafc', dark: '#0b1220' };

const getSystemPreference = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Reads a previously saved theme, falling back to the OS-level preference
// when the person has never chosen one explicitly on this site.
const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // localStorage unavailable — fall through to system preference
  }
  return getSystemPreference();
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.light);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore write failures (private browsing, storage full, etc.)
    }
  }, [theme]);

  // Follow the OS preference live, but only until the person picks a theme
  // explicitly here (tracked by the presence of a saved value).
  useEffect(() => {
    let hasExplicitChoice = false;
    try {
      hasExplicitChoice = localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      hasExplicitChoice = false;
    }
    if (hasExplicitChoice) return undefined;
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setTheme(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
