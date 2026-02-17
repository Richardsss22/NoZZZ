import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FatigueLevel = 'normal' | 'tired' | 'critical';

interface DrowsinessState {
    yaw: number;
    pitch: number;
    roll: number;
    ear: number; // Eye Aspect Ratio
    fatigueLevel: FatigueLevel;
    isDrowsy: boolean;
    countdown: number;
    emergencyContact: string;

    updateHeadPose: (yaw: number, pitch: number, roll: number) => void;
    setEAR: (ear: number) => void;
    resetAlert: () => void;
    setEmergencyContact: (contact: string) => Promise<void>;
    loadSettings: () => Promise<void>;
    history: any[];
}

export const useDrowsinessStore = create<DrowsinessState>((set, get) => ({
    yaw: 0,
    pitch: 0,
    roll: 0,
    ear: 0.3,
    fatigueLevel: 'normal',
    isDrowsy: false,
    countdown: 10,
    emergencyContact: '112', // Persistence default to 112

    updateHeadPose: (yaw, pitch, roll) => {
        set({ yaw, pitch, roll });
    },

    setEAR: (ear) => {
        set({ ear });
    },

    resetAlert: () => {
        set({ isDrowsy: false, countdown: 10 });
    },

    setEmergencyContact: async (contact) => {
        set({ emergencyContact: contact });
        await AsyncStorage.setItem('emergency_contact', contact);
    },

    loadSettings: async () => {
        try {
            const contact = await AsyncStorage.getItem('emergency_contact');
            if (contact) {
                set({ emergencyContact: contact });
            } else {
                set({ emergencyContact: '112' });
            }
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    },
    history: []
}));
