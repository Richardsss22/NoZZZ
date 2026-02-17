import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language, TranslationKey } from './translations';

interface I18nState {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    loadLanguage: () => Promise<void>;
    t: (key: TranslationKey) => string;
}

export const useI18nStore = create<I18nState>((set, get) => ({
    language: 'pt' as Language, // Default Portuguese

    setLanguage: async (lang: Language) => {
        set({ language: lang });
        await AsyncStorage.setItem('language', lang);
    },

    loadLanguage: async () => {
        const saved = await AsyncStorage.getItem('language');
        if (saved && (saved === 'pt' || saved === 'en')) {
            set({ language: saved as Language });
        }
    },

    t: (key: TranslationKey) => {
        const { language } = get();
        return translations[language][key] || key;
    },
}));

// Initialize on app start
useI18nStore.getState().loadLanguage();
