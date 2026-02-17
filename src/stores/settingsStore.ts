import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ExpoFsStorage } from '../storage/ExpoFsStorage';

export type SafetyMode = 'driving' | 'study' | 'custom';

type SettingsState = {
  // contactos/segurança
  emergencyPhone: string;          // guardar como string (permite "+351...")
  setEmergencyPhone: (v: string) => void;

  // preferências gerais
  language: 'pt' | 'en';
  setLanguage: (v: 'pt' | 'en') => void;

  // modo (se quiseres que fique guardado aqui em vez do EyeDetectionStore)
  preferredMode: SafetyMode;
  setPreferredMode: (v: SafetyMode) => void;

  // extras úteis
  alarmEnabled: boolean;
  setAlarmEnabled: (v: boolean) => void;

  strobeEnabled: boolean;
  setStrobeEnabled: (v: boolean) => void;

  // reset total de settings
  resetSettings: () => void;
};

const DEFAULTS: Omit<
  SettingsState,
  | 'setEmergencyPhone'
  | 'setLanguage'
  | 'setPreferredMode'
  | 'setAlarmEnabled'
  | 'setStrobeEnabled'
  | 'resetSettings'
> = {
  emergencyPhone: '',
  language: 'pt',
  preferredMode: 'driving',
  alarmEnabled: true,
  strobeEnabled: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setEmergencyPhone: (v) =>
        set({ emergencyPhone: (v ?? '').trim() }),

      setLanguage: (v) => set({ language: v }),

      setPreferredMode: (v) => set({ preferredMode: v }),

      setAlarmEnabled: (v) => set({ alarmEnabled: v }),

      setStrobeEnabled: (v) => set({ strobeEnabled: v }),

      resetSettings: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'settingsStore-v1',
      storage: createJSONStorage(() => ExpoFsStorage),
      version: 1,
    }
  )
);