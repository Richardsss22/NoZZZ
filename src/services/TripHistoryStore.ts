import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TripSummary {
  id: string;
  startTime: string;   // ISO string
  endTime: string;     // ISO string
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  alarmCount: number;
}

interface TripHistoryState {
  trips: TripSummary[];

  // Ações
  addTrip: (trip: Omit<TripSummary, 'id'> & { id?: string }) => string;
  updateTrip: (id: string, patch: Partial<TripSummary>) => void;
  clearAll: () => void;
}

export const useTripHistoryStore = create<TripHistoryState>()(
  persist(
    (set, get) => ({
      trips: [],

      addTrip: (trip) => {
        const id = trip.id ?? Date.now().toString();
        const newTrip: TripSummary = {
          id,
          ...trip,
        };
        set((state) => ({
          trips: [...state.trips, newTrip],
        }));
        return id;
      },

      updateTrip: (id, patch) => {
        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === id ? { ...t, ...patch } : t
          ),
        }));
      },

      clearAll: () => {
        set({ trips: [] });
      },
    }),
    {
      name: 'tripControl_v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
