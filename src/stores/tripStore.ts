import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ExpoFsStorage } from '../storage/ExpoFsStorage';

export type TripEvent = {
  id: string;
  type: 'alarm' | 'trip_start' | 'trip_end';
  ts: number; // Date.now()
  lat?: number;
  lon?: number;
  speedKmh?: number;
};

export type TripSummary = {
  id: string;
  startedAt: number;
  endedAt?: number;
  distanceKm?: number;
  avgSpeedKmh?: number;
};

interface TripState {
  events: TripEvent[];
  trips: TripSummary[];

  addEvent: (e: TripEvent) => void;
  addTrip: (t: TripSummary) => void;
  updateTrip: (id: string, patch: Partial<TripSummary>) => void;

  clearAll: () => void;
}

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      events: [],
      trips: [],

      addEvent: (e) => set((s) => ({ events: [e, ...s.events].slice(0, 2000) })),
      addTrip: (t) => set((s) => ({ trips: [t, ...s.trips].slice(0, 500) })),
      updateTrip: (id, patch) =>
        set((s) => ({
          trips: s.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      clearAll: () => set({ events: [], trips: [] }),
    }),
    {
      name: 'tripStore-v1',
      storage: createJSONStorage(() => ExpoFsStorage),
    }
  )
);