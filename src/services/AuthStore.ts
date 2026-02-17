import { create } from 'zustand';

// MOCK AUTH STORE - Firebase removed temporarily
interface AuthState {
    user: any | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: { email: 'guest@oculus.app', displayName: 'Guest Driver' }, // Default mock user
    loading: false,

    init: () => {
        console.log('AuthStore initialized (MOCK MODE)');
        set({ loading: false });
    },

    signInWithGoogle: async () => {
        console.log('Mock Sign In');
        set({ user: { email: 'demo@oculus.app', displayName: 'Demo User' } });
    },

    signOut: async () => {
        console.log('Mock Sign Out');
        set({ user: null });
    },
}));

// Initialize auth listener on app start
useAuthStore.getState().init();
