import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CustomSettings {
    eyeClosureDuration: number; // seconds before alarm triggers
    eyeOpenThreshold: number; // 0.0-1.0, lower = more sensitive
}

interface CustomSettingsState {
    settings: CustomSettings;
    isCustomMode: boolean;
    setCustomMode: (enabled: boolean) => void;
    updateSettings: (newSettings: Partial<CustomSettings>) => Promise<void>;
    loadSettings: () => Promise<void>;
}

const DEFAULT_SETTINGS: CustomSettings = {
    eyeClosureDuration: 5, // 5 seconds default
    eyeOpenThreshold: 0.4, // 40% probability threshold
};

export const useCustomSettingsStore = create<CustomSettingsState>((set, get) => ({
    settings: DEFAULT_SETTINGS,
    isCustomMode: false,

    setCustomMode: (enabled: boolean) => {
        set({ isCustomMode: enabled });
        AsyncStorage.setItem('isCustomMode', JSON.stringify(enabled));
    },

    updateSettings: async (newSettings: Partial<CustomSettings>) => {
        const updatedSettings = { ...get().settings, ...newSettings };
        set({ settings: updatedSettings });
        await AsyncStorage.setItem('customSettings', JSON.stringify(updatedSettings));
        console.log('Custom settings saved:', updatedSettings);
    },

    loadSettings: async () => {
        try {
            const savedSettings = await AsyncStorage.getItem('customSettings');
            const savedMode = await AsyncStorage.getItem('isCustomMode');

            if (savedSettings) {
                set({ settings: JSON.parse(savedSettings) });
            }

            if (savedMode) {
                set({ isCustomMode: JSON.parse(savedMode) });
            }
        } catch (error) {
            console.log('Error loading custom settings:', error);
        }
    },
}));

// Load settings on app start
useCustomSettingsStore.getState().loadSettings();
