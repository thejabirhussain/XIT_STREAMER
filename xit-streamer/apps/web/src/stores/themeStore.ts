import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem('xit-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  // Default to dark theme
  return 'dark';
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: getInitialTheme(),
  setTheme: (theme: Theme) => {
    localStorage.setItem('xit-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  toggleTheme: () => {
    const current = get().theme;
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('xit-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    set({ theme: next });
  },
}));

// Apply theme on initial load
const initialTheme = getInitialTheme();
if (initialTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light');
}
