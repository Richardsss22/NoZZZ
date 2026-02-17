// src/services/LocationService.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { create } from 'zustand';
import { useTripHistoryStore } from './TripHistoryStore';

interface LocationState {
  isDriving: boolean;
  speed: number; // km/h
  location: Location.LocationObject | null;

  // Dados da viagem atual
  currentTripId: string | null;
  tripStartTime: string | null; // ISO
  lastLocation: Location.LocationObject | null;
  distanceKmThisTrip: number;
  maxSpeedThisTrip: number;

  startTracking: () => Promise<void>;
  stopTracking: () => void;
  incrementAlertCount: () => void;
  handleUpdate: (location: Location.LocationObject) => void;
}

const LOCATION_TASK_NAME = 'background-location-task';

// Define task if TaskManager is available (it should be with expo-location)
try {
  TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }: { data: any, error: any }) => {
    if (error) {
      console.error(error);
      return;
    }
    if (data) {
      const { locations } = data;
      const loc = locations[0];
      if (loc) {
        useLocationStore.getState().handleUpdate(loc);
      }
    }
  });
} catch (e) {
  console.log('TaskManager defineTask failed (maybe running on web?):', e);
}

let locationSubscription: Location.LocationSubscription | null = null;

// variáveis auxiliares para evitar entrar/sair de “condução” a toda a hora
let speedAboveThresholdSince: number | null = null;
let speedBelowThresholdSince: number | null = null;

// Distância em km entre 2 coordenadas (Haversine)
function distanceKmBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// thresholds (podes afinar estes valores)
const DRIVE_START_THRESHOLD = 15; // km/h
const DRIVE_STOP_THRESHOLD = 8;   // km/h (histerese para não oscilar)
const MIN_DRIVE_START_SECONDS = 10;  // precisa de andar >15 km/h pelo menos 10s
const MIN_DRIVE_STOP_SECONDS = 120;  // precisa de andar devagar/parado 2min para terminar viagem

export const useLocationStore = create<LocationState>((set, get) => ({
  isDriving: false,
  speed: 0,
  location: null,

  currentTripId: null,
  tripStartTime: null,
  lastLocation: null,
  distanceKmThisTrip: 0,
  maxSpeedThisTrip: 0,

  startTracking: async () => {
    // Tenta obter permissão de BACKGROUND, se falhar tenta Foreground
    let { status } = await Location.requestBackgroundPermissionsAsync();

    // Se não der background (ou utilizador não deixou "Always"), tenta foreground
    if (status !== 'granted') {
      const fg = await Location.requestForegroundPermissionsAsync();
      status = fg.status;
    }

    if (status !== 'granted') {
      console.warn('Permission to access location was denied');
      return;
    }

    // Se já estiver a correr, pára anterior
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch { }

    // Inicia Background Service (Notificação Persistente)
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,
      deferredUpdatesInterval: 1000,
      foregroundService: {
        notificationTitle: "Oculus Safe",
        notificationBody: "Monitorização ativa em segundo plano 🚗",
        notificationColor: "#2196F3"
      }
    });
  },

  handleUpdate: (location) => {
    const speedMs = location.coords.speed || 0;
    const speedKmh = speedMs * 3.6;
    const state = get();
    const now = Date.now();

    let {
      isDriving,
      currentTripId,
      tripStartTime,
      distanceKmThisTrip,
      maxSpeedThisTrip,
      lastLocation,
    } = state;

    // 1) LÓGICA PARA COMEÇAR VIAGEM AUTOMÁTICA
    if (!currentTripId) {
      if (speedKmh > DRIVE_START_THRESHOLD) {
        if (!speedAboveThresholdSince) {
          speedAboveThresholdSince = now;
        } else {
          const elapsedSec =
            (now - speedAboveThresholdSince) / 1000;
          if (elapsedSec >= MIN_DRIVE_START_SECONDS) {
            // Começar nova viagem
            const nowIso = new Date().toISOString();
            const tripStore = useTripHistoryStore.getState();
            const id = tripStore.addTrip({
              startTime: nowIso,
              endTime: nowIso, // placeholder
              distanceKm: 0,
              avgSpeedKmh: 0,
              maxSpeedKmh: 0,
              alarmCount: 0,
            });

            console.log('🚗 Trip auto-started with id', id);

            isDriving = true;
            currentTripId = id;
            tripStartTime = nowIso;
            distanceKmThisTrip = 0;
            maxSpeedThisTrip = 0;
            lastLocation = location;

            // reset marcador
            speedAboveThresholdSince = null;
          }
        }
      } else {
        speedAboveThresholdSince = null;
      }
    } else {
      // 2) LÓGICA PARA TERMINAR VIAGEM AUTOMÁTICA
      if (speedKmh < DRIVE_STOP_THRESHOLD) {
        if (!speedBelowThresholdSince) {
          speedBelowThresholdSince = now;
        } else {
          const elapsedSec =
            (now - speedBelowThresholdSince) / 1000;
          if (elapsedSec >= MIN_DRIVE_STOP_SECONDS) {
            // Terminar viagem
            const endTimeIso = new Date().toISOString();
            if (tripStartTime) {
              const startMs = new Date(tripStartTime).getTime();
              const endMs = new Date(endTimeIso).getTime();
              const hours = Math.max(0, endMs - startMs) / (1000 * 60 * 60);
              const avgSpeed =
                hours > 0 ? distanceKmThisTrip / hours : 0;

              const tripStore = useTripHistoryStore.getState();
              tripStore.updateTrip(currentTripId, {
                endTime: endTimeIso,
                distanceKm: distanceKmThisTrip,
                maxSpeedKmh: maxSpeedThisTrip,
                avgSpeedKmh: avgSpeed,
              });

              console.log('🛑 Trip auto-ended with id', currentTripId);
            }

            isDriving = false;
            currentTripId = null;
            tripStartTime = null;
            distanceKmThisTrip = 0;
            maxSpeedThisTrip = 0;
            lastLocation = location;

            // reset marcador
            speedBelowThresholdSince = null;
          }
        }
      } else {
        speedBelowThresholdSince = null;
      }
    }

    // 3) SE HOUVER VIAGEM ATIVA → ACUMULAR DISTÂNCIA E VELOCIDADE
    if (isDriving && currentTripId) {
      if (lastLocation) {
        const d = distanceKmBetween(
          lastLocation.coords.latitude,
          lastLocation.coords.longitude,
          location.coords.latitude,
          location.coords.longitude
        );

        // Proteção contra “saltos” manhosos de GPS
        if (d > 0 && d < 5) {
          distanceKmThisTrip += d;
        }
      }

      if (speedKmh > maxSpeedThisTrip) {
        maxSpeedThisTrip = speedKmh;
      }

      if (tripStartTime) {
        const startMs = new Date(tripStartTime).getTime();
        const nowMs = Date.now();
        const hours = Math.max(0, nowMs - startMs) / (1000 * 60 * 60);
        const avgSpeed =
          hours > 0 ? distanceKmThisTrip / hours : 0;

        const tripStore = useTripHistoryStore.getState();
        tripStore.updateTrip(currentTripId, {
          distanceKm: distanceKmThisTrip,
          maxSpeedKmh: maxSpeedThisTrip,
          avgSpeedKmh: avgSpeed,
          endTime: new Date().toISOString(), // vai sendo atualizado
        });
      }
    }

    set(() => ({
      isDriving,
      currentTripId,
      tripStartTime,
      distanceKmThisTrip,
      maxSpeedThisTrip,
      lastLocation: location,
      location,
      speed: speedKmh,
    }));
  },

  stopTracking: () => {
    const state = get();

    // Se houver viagem ativa, finaliza-a
    if (state.currentTripId && state.tripStartTime) {
      const endTimeIso = new Date().toISOString();
      const startMs = new Date(state.tripStartTime).getTime();
      const endMs = new Date(endTimeIso).getTime();
      const hours = Math.max(0, endMs - startMs) / (1000 * 60 * 60);
      const avgSpeed =
        hours > 0 ? state.distanceKmThisTrip / hours : 0;

      const tripStore = useTripHistoryStore.getState();
      tripStore.updateTrip(state.currentTripId, {
        endTime: endTimeIso,
        distanceKm: state.distanceKmThisTrip,
        maxSpeedKmh: state.maxSpeedThisTrip,
        avgSpeedKmh: avgSpeed,
      });

      console.log('🛑 Trip ended via stopTracking with id', state.currentTripId);
    }

    // Pára updates de background
    Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => { });
    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }

    speedAboveThresholdSince = null;
    speedBelowThresholdSince = null;

    set({
      isDriving: false,
      currentTripId: null,
      tripStartTime: null,
      lastLocation: null,
      distanceKmThisTrip: 0,
      maxSpeedThisTrip: 0,
      speed: 0,
    });
  },

  incrementAlertCount: () => {
    const { currentTripId, distanceKmThisTrip, maxSpeedThisTrip, tripStartTime } = get();
    if (!currentTripId) return;

    // Calcular avgSpeed atual para não perder precisão
    let avgSpeed = 0;
    if (tripStartTime) {
      const startMs = new Date(tripStartTime).getTime();
      const nowMs = Date.now();
      const hours = Math.max(0, nowMs - startMs) / (1000 * 60 * 60);
      avgSpeed = hours > 0 ? distanceKmThisTrip / hours : 0;
    }

    const tripStore = useTripHistoryStore.getState();
    const currentTrip = tripStore.trips.find(t => t.id === currentTripId);

    // Incrementa contagem
    const newCount = (currentTrip?.alarmCount || 0) + 1;

    tripStore.updateTrip(currentTripId, {
      alarmCount: newCount,
      // Manter os outros atualizados para garantir consistência
      distanceKm: distanceKmThisTrip,
      maxSpeedKmh: maxSpeedThisTrip,
      avgSpeedKmh: avgSpeed
    });

    console.log(`🚨 Alert Count incremented to ${newCount} for trip ${currentTripId}`);
  },
}));
