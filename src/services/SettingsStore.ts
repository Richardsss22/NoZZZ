import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
    settings: {
        smartwatchEnabled: boolean;
    };
    updateSettings: (newSettings: Partial<{ smartwatchEnabled: boolean }>) => void;
    loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    settings: {
        smartwatchEnabled: false,
    },

    updateSettings: async (newSettings) => {
        const updatedSettings = { ...get().settings, ...newSettings };
        set({ settings: updatedSettings });
        await AsyncStorage.setItem('app_settings', JSON.stringify(updatedSettings));
    },

    loadSettings: async () => {
        try {
            const savedSettings = await AsyncStorage.getItem('app_settings');
            if (savedSettings) {
                set({ settings: JSON.parse(savedSettings) });
            }
        } catch (error) {
            console.log('Error loading settings:', error);
        }
    },
}));
