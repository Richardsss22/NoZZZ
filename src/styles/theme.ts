import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Theme = {
  background: [string, string, ...string[]]; // Tuplo para LinearGradient
  card: string;
  elevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentDark: string;
  accentLight: string;
  accentGlow: string;
  border: string;
  danger: string;
  success: string;
  warning: string;
  inputBg: string;
  inactive: string;
  shadow: any;
  shadowLg: any;
  blobs: string[];
};

export type Accent = 'ocean' | 'blue' | 'sunrise' | 'black';

interface ThemeState {
  isDarkMode: boolean;
  accent: Accent;
  setDarkMode: (v: boolean) => void;
  toggleDarkMode: () => void;
  setAccent: (a: Accent) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDarkMode: false,
      accent: 'ocean',

      setDarkMode: (v) => set({ isDarkMode: v }),
      toggleDarkMode: () => set({ isDarkMode: !get().isDarkMode }),
      setAccent: (a) => set({ accent: a }),
    }),
    {
      name: 'themeStore-v3',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const getTheme = (isDark: boolean, accent: Accent = 'ocean'): Theme => {
  if (isDark) {
    switch (accent) {
      case 'blue': return darkBlueTheme;
      case 'sunrise': return darkSunriseTheme;
      case 'black': return pitchBlackTheme;
      case 'ocean':
      default: return darkOceanTheme;
    }
  } else {
    switch (accent) {
      case 'blue': return lightBlueTheme;
      case 'sunrise': return lightSunriseTheme;
      case 'ocean':
      default: return lightOceanTheme;
    }
  }
};

const commonShadows = (isDark: boolean) => ({
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  shadowLg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: isDark ? 0.5 : 0.2,
    shadowRadius: 20,
    elevation: 20,
  }
});

const lightOceanTheme: Theme = {
  background: ['#f0fdfa', '#ccfbf1', '#a5f3fc', '#7dd3fc'],
  card: 'rgba(255, 255, 255, 0.92)',
  elevated: 'rgba(255, 255, 255, 0.7)',
  text: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
  accent: '#06b6d4',
  accentDark: '#0891b2',
  accentLight: 'rgba(6, 182, 212, 0.12)',
  accentGlow: 'rgba(6, 182, 212, 0.3)',
  border: 'rgba(255, 255, 255, 0.6)',
  danger: '#f43f5e',
  success: '#10b981',
  warning: '#f59e0b',
  inputBg: 'rgba(0,0,0,0.03)',
  inactive: '#94a3b8',
  ...commonShadows(false),
  blobs: ['rgba(6, 182, 212, 0.4)', 'rgba(59, 130, 246, 0.3)', 'rgba(168, 85, 247, 0.2)']
};

const lightBlueTheme: Theme = {
  background: ['#eff6ff', '#dbeafe', '#bfdbfe'],
  card: 'rgba(255, 255, 255, 0.95)',
  elevated: 'rgba(255, 255, 255, 0.8)',
  text: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
  accent: '#3b82f6',
  accentDark: '#1d4ed8',
  accentLight: 'rgba(59, 130, 246, 0.12)',
  accentGlow: 'rgba(59, 130, 246, 0.3)',
  border: 'rgba(255, 255, 255, 0.6)',
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  inputBg: 'rgba(0,0,0,0.03)',
  inactive: '#94a3b8',
  ...commonShadows(false),
  blobs: ['rgba(59, 130, 246, 0.4)', 'rgba(37, 99, 235, 0.3)', 'rgba(147, 51, 234, 0.2)']
};

const lightSunriseTheme: Theme = {
  background: ['#fff7ed', '#ffedd5', '#fed7aa', '#fbcfe8'],
  card: 'rgba(255, 255, 255, 0.9)',
  elevated: 'rgba(255, 255, 255, 0.75)',
  text: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
  accent: '#f97316',
  accentDark: '#ea580c',
  accentLight: 'rgba(249, 115, 22, 0.12)',
  accentGlow: 'rgba(249, 115, 22, 0.3)',
  border: 'rgba(255, 255, 255, 0.6)',
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  inputBg: 'rgba(0,0,0,0.03)',
  inactive: '#94a3b8',
  ...commonShadows(false),
  blobs: ['rgba(249, 115, 22, 0.4)', 'rgba(236, 72, 153, 0.3)', 'rgba(168, 85, 247, 0.2)']
};

const darkOceanTheme: Theme = {
  background: ['#020617', '#0c4a6e', '#164e63'],
  card: 'rgba(15, 23, 42, 0.75)',
  elevated: 'rgba(30, 41, 59, 0.6)',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textTertiary: '#64748b',
  accent: '#22d3ee',
  accentDark: '#06b6d4',
  accentLight: 'rgba(34, 211, 238, 0.15)',
  accentGlow: 'rgba(34, 211, 238, 0.4)',
  border: 'rgba(255, 255, 255, 0.08)',
  danger: '#f43f5e',
  success: '#10b981',
  warning: '#f59e0b',
  inputBg: 'rgba(255,255,255,0.05)',
  inactive: '#64748b',
  ...commonShadows(true),
  blobs: ['rgba(34, 211, 238, 0.25)', 'rgba(59, 130, 246, 0.2)', 'rgba(168, 85, 247, 0.15)']
};

const darkBlueTheme: Theme = {
  background: ['#020617', '#1e1b4b', '#312e81'],
  card: 'rgba(15, 23, 42, 0.8)',
  elevated: 'rgba(30, 41, 59, 0.65)',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textTertiary: '#64748b',
  accent: '#60a5fa',
  accentDark: '#3b82f6',
  accentLight: 'rgba(96, 165, 250, 0.15)',
  accentGlow: 'rgba(96, 165, 250, 0.4)',
  border: 'rgba(255, 255, 255, 0.08)',
  danger: '#f43f5e',
  success: '#10b981',
  warning: '#f59e0b',
  inputBg: 'rgba(255,255,255,0.05)',
  inactive: '#64748b',
  ...commonShadows(true),
  blobs: ['rgba(96, 165, 250, 0.25)', 'rgba(139, 92, 246, 0.2)', 'rgba(236, 72, 153, 0.15)']
};

const darkSunriseTheme: Theme = {
  background: ['#1a0b2e', '#4c1d95', '#7c2d12'],
  card: 'rgba(15, 23, 42, 0.8)',
  elevated: 'rgba(30, 41, 59, 0.65)',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textTertiary: '#64748b',
  accent: '#fb923c',
  accentDark: '#f97316',
  accentLight: 'rgba(251, 146, 60, 0.15)',
  accentGlow: 'rgba(251, 146, 60, 0.4)',
  border: 'rgba(255, 255, 255, 0.08)',
  danger: '#f43f5e',
  success: '#10b981',
  warning: '#f59e0b',
  inputBg: 'rgba(255,255,255,0.05)',
  inactive: '#64748b',
  ...commonShadows(true),
  blobs: ['rgba(251, 146, 60, 0.25)', 'rgba(236, 72, 153, 0.2)', 'rgba(139, 92, 246, 0.15)']
};

const pitchBlackTheme: Theme = {
  background: ['#000000', '#000000'],
  card: 'rgba(23, 23, 23, 0.95)',
  elevated: 'rgba(38, 38, 38, 0.9)',
  text: '#fafafa',
  textSecondary: '#a3a3a3',
  textTertiary: '#525252',
  accent: '#ffffff',
  accentDark: '#e5e5e5',
  accentLight: 'rgba(255, 255, 255, 0.1)',
  accentGlow: 'rgba(255, 255, 255, 0.2)',
  border: 'rgba(255, 255, 255, 0.06)',
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  inputBg: 'rgba(38, 38, 38, 0.9)',
  inactive: '#525252',
  ...commonShadows(true),
  blobs: []
};
