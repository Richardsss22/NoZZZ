import { create } from 'zustand';
import VolumeModule from '../native/VolumeModule';
import { useLocationStore } from './LocationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDrowsinessStore } from './DrowsinessDetector';

type FaceLike = any;

type SafetyMode = 'driving' | 'study' | 'custom';

type CustomConfig = {
  requireDriving: boolean;
  alarmAfterMs: number;
  eyeClosedThreshold: number;
};

interface EyeDetectionState {
  isCameraActive: boolean;

  faceDetected: boolean;
  leftEyeOpen: number;
  rightEyeOpen: number;

  isEyesClosed: boolean;
  eyesClosedDuration: number;

  alarmPlaying: boolean;

  alarmHistory: number[]; // timestamps of recent alarms
  suggestRestStop: boolean; // triggers the UI popup
  dismissRestStop: () => void;

  mode: SafetyMode;
  setMode: (mode: SafetyMode) => void;

  custom: CustomConfig;
  setCustom: (patch: Partial<CustomConfig>) => void;

  startCamera: () => void;
  pauseCamera: () => void;
  stopCamera: () => Promise<void>;

  stopAlarm: () => Promise<void>;
  triggerAlarm: () => Promise<void>;

  updateFaceData: (faces: FaceLike[], isFrontCamera?: boolean) => void;
  loadSettings: () => Promise<void>;
  globalThreshold: number;
  setGlobalThreshold: (val: number) => void;

  // CALIBRATION
  isCalibrating: boolean;
  calibrationProgress: number; // 0-100
  startCalibration: () => void;
  cancelCalibration: () => void;
  calibrationSamples: number[];

  // NIGHT MODE
  isNightRun: boolean;
  toggleNightRun: () => void;

  callCountdown: number; // Seconds until emergency call
}

const FACE_TIMEOUT_MS = 1500;

const DEFAULT_ALARM_AFTER_MS = 2500;
const DEFAULT_THRESHOLD = 0.38;
const DEFAULT_REQUIRE_DRIVING = true;

const SMOOTH_ALPHA = 0.35;
const STOP_THRESHOLD_OFFSET = 0.10;

let eyesClosedSince: number | null = null;
let lastFaceSeenAt: number | null = null;

let leftSmooth = 1;
let rightSmooth = 1;

let triggering = false;

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 1;
  if (v > 1) v = v / 100;
  return Math.max(0, Math.min(1, v));
}

function pickEyeProb(face: any, side: 'left' | 'right'): number {
  const keys =
    side === 'left'
      ? ['leftEyeOpenProbability', 'leftEyeOpenProb', 'leftEyeOpen', 'probabilityLeftEyeOpen']
      : ['rightEyeOpenProbability', 'rightEyeOpenProb', 'rightEyeOpen', 'probabilityRightEyeOpen'];

  for (const k of keys) {
    const v = face?.[k];
    if (typeof v === 'number') return clamp01(v);
  }
  return 1;
}

function isDrivingNow() {
  const { isDriving, speed } = useLocationStore.getState();
  const drivingBySpeed = (speed ?? 0) > 15;
  return Boolean(isDriving || drivingBySpeed);
}

function getEffectiveConfig(state: EyeDetectionState) {
  const threshold = state.globalThreshold || DEFAULT_THRESHOLD;
  if (state.mode === 'driving') {
    return { requireDriving: true, alarmAfterMs: DEFAULT_ALARM_AFTER_MS, eyeClosedThreshold: threshold };
  }
  if (state.mode === 'study') {
    return { requireDriving: false, alarmAfterMs: DEFAULT_ALARM_AFTER_MS, eyeClosedThreshold: threshold };
  }
  return { ...state.custom, eyeClosedThreshold: threshold };
}

async function stopAlarmNative() {
  try { await VolumeModule.stopAlarm(); } catch { }
  try { await VolumeModule.stopStrobe(); } catch { }
}

function resetTracking() {
  eyesClosedSince = null;
  lastFaceSeenAt = null;
  leftSmooth = 1;
  rightSmooth = 1;
  triggering = false;
}

export const useEyeDetectionStore = create<EyeDetectionState>((set, get) => ({
  isCameraActive: false,

  faceDetected: false,
  leftEyeOpen: 1,
  rightEyeOpen: 1,

  isEyesClosed: false,
  eyesClosedDuration: 0,

  alarmPlaying: false,

  mode: 'driving',
  setMode: (mode) => set({ mode }),

  custom: {
    requireDriving: DEFAULT_REQUIRE_DRIVING,
    alarmAfterMs: DEFAULT_ALARM_AFTER_MS,
    eyeClosedThreshold: DEFAULT_THRESHOLD,
  },
  setCustom: (patch) => set((s) => ({ custom: { ...s.custom, ...patch } })),

  globalThreshold: DEFAULT_THRESHOLD,
  setGlobalThreshold: async (val) => {
    set({ globalThreshold: val });
    await AsyncStorage.setItem('eye_threshold', val.toString());
  },

  alarmHistory: [],
  suggestRestStop: false,
  dismissRestStop: () => set({ suggestRestStop: false }),

  isCalibrating: false,
  calibrationProgress: 0,
  calibrationSamples: [] as number[],

  callCountdown: 10,

  startCalibration: () => {
    set({ isCalibrating: true, calibrationProgress: 0, calibrationSamples: [], isCameraActive: true });
    console.log('[EyeDetection] Starting Calibration...');
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      set({ calibrationProgress: Math.min(100, p) });
      if (p >= 100) {
        clearInterval(interval);
        // finishCalibration is confusing to call here because store isn't 'this'.
        // We'll rely on the UI to call finish or just finish automatically in logic?
        // Let's implement finish logic inside this interval closure using get().
        const { calibrationSamples } = useEyeDetectionStore.getState(); // or get() if available
        // But 'get' is not available in interval closure easily unless we capture it?
        // Actually we can just use useEyeDetectionStore.getState().

        const samples = useEyeDetectionStore.getState().calibrationSamples;
        if (samples && samples.length > 5) {
          const sum = samples.reduce((a, b) => a + b, 0);
          const avg = sum / samples.length;
          // Formula: Threshold = Avg * 0.5
          const newThreshold = Math.max(0.15, Math.min(0.8, avg * 0.5));
          console.log(`[EyeDetection] Calibration Done. Avg: ${avg.toFixed(2)} -> New Threshold: ${newThreshold.toFixed(2)}`);
          useEyeDetectionStore.getState().setGlobalThreshold(newThreshold);
        }

        set({ isCalibrating: false, calibrationProgress: 100 });
      }
    }, 300);
  },

  cancelCalibration: () => {
    set({ isCalibrating: false, calibrationProgress: 0, calibrationSamples: [] });
  },

  isNightRun: false,
  toggleNightRun: () => set(s => ({ isNightRun: !s.isNightRun })),

  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem('eye_threshold');
      if (stored) {
        set({ globalThreshold: parseFloat(stored) });
      }
    } catch (e) {
      console.error('Failed to load eye settings', e);
    }
  },

  startCamera: () => {
    resetTracking();

    const hour = new Date().getHours();
    const isNight = hour >= 20 || hour < 7; // Night mode auto

    set({
      isCameraActive: true,
      faceDetected: false,
      leftEyeOpen: 1,
      rightEyeOpen: 1,
      isEyesClosed: false,
      eyesClosedDuration: 0,
      isNightRun: isNight // Auto-enable
    });

    console.log('[EyeDetection] Camera started. Night Mode:', isNight);
  },

  pauseCamera: () => {
    // Pausa só a câmara. Não pára alarme.
    set({ isCameraActive: false });
    console.log('[EyeDetection] Camera paused');
  },

  stopAlarm: async () => {
    const { alarmPlaying } = get();
    if (!alarmPlaying) return;

    await stopAlarmNative();
    set({ alarmPlaying: false, callCountdown: 10 });

    console.log('[EyeDetection] Alarm stopped');
  },

  stopCamera: async () => {
    resetTracking();

    // parar alarme também
    const { alarmPlaying } = get();
    if (alarmPlaying) await stopAlarmNative();

    set({
      isCameraActive: false,
      faceDetected: false,
      leftEyeOpen: 1,
      rightEyeOpen: 1,
      isEyesClosed: false,
      eyesClosedDuration: 0,
      alarmPlaying: false,
      callCountdown: 10,
    });

    console.log('[EyeDetection] Camera stopped + alarm stopped');
  },

  triggerAlarm: async () => {
    const state = get();
    if (state.alarmPlaying || triggering) return;

    triggering = true;
    console.log('[EyeDetection] 🚨 EXTERNAL TRIGGER (Sensor/Manual)');

    set({ alarmPlaying: true, isCameraActive: false });

    try {
      await new Promise(r => setTimeout(r, 500));
      await VolumeModule.setMaxVolume();
      await VolumeModule.playAlarm();

      // INCREMENT ALERT COUNT
      useLocationStore.getState().incrementAlertCount();

      // --- REST STOP LOGIC ---
      const now = Date.now();
      const { alarmHistory } = get();
      // Clean old history (> 15 min)
      const fifteenMinAgo = now - 15 * 60 * 1000;
      const recentAlarms = alarmHistory.filter(t => t > fifteenMinAgo);

      // Add current
      recentAlarms.push(now);

      // If >= 2 alarms in 15m, suggest rest
      if (recentAlarms.length >= 2) {
        set({ suggestRestStop: true });
        console.log('[EyeDetection] 🚨 FATIGUE DETECTED: Suggesting Rest Stop');
      }

      set({ alarmHistory: recentAlarms });
      // -----------------------


      const strobeEnabled = await AsyncStorage.getItem('strobe_enabled');
      if (strobeEnabled !== 'false') {
        await VolumeModule.strobeFlashlight();
      }

      console.log('[EyeDetection] Alarm started OK');

      let remaining = 10;
      set({ callCountdown: remaining });

      const countdownInterval = setInterval(async () => {
        const currentState = get();
        if (!currentState.alarmPlaying) {
          clearInterval(countdownInterval);
          return;
        }

        remaining -= 1;
        set({ callCountdown: Math.max(0, remaining) });

        if (remaining <= 0) {
          clearInterval(countdownInterval);
          const { emergencyContact } = useDrowsinessStore.getState();
          let contactToCall = '112';
          if (emergencyContact && emergencyContact.trim().length > 0) {
            contactToCall = emergencyContact;
          }
          console.log(`[EyeDetection] 10s elapsed. Calling ${contactToCall}...`);
          try {
            await VolumeModule.callPhone(contactToCall);
          } catch (err) {
            console.error('Failed to make direct call', err);
            const { Linking } = require('react-native');
            Linking.openURL(`tel:${contactToCall}`);
          }
        }
      }, 1000);

    } catch (e) {
      console.log('[EyeDetection] Alarm failed', e);
      set({ alarmPlaying: false });
    } finally {
      triggering = false;
    }
  },

  updateFaceData: (faces, isFrontCamera = true) => {
    const now = Date.now();
    const state = get();

    if (!state.isCameraActive) return;

    const cfg = getEffectiveConfig(state);

    if (state.isCalibrating) {
      if (!faces || faces.length === 0) return;
      const face = faces[0];
      const l = pickEyeProb(face, 'left');
      const r = pickEyeProb(face, 'right');
      const avg = (l + r) / 2;
      // Add to samples
      useEyeDetectionStore.setState(s => ({
        calibrationSamples: [...(s as any).calibrationSamples, avg]
      }));
      return; // Skip normal logic
    }

    if (!faces || faces.length === 0) {
      if (lastFaceSeenAt && now - lastFaceSeenAt > FACE_TIMEOUT_MS) {
        eyesClosedSince = null;
        set({
          faceDetected: false,
          leftEyeOpen: 1,
          rightEyeOpen: 1,
          isEyesClosed: false,
          eyesClosedDuration: 0,
        });
      }
      return;
    }

    lastFaceSeenAt = now;
    const face = faces[0];

    const rawLeft = pickEyeProb(face, 'left');
    const rawRight = pickEyeProb(face, 'right');

    const leftRawFixed = isFrontCamera ? rawRight : rawLeft;
    const rightRawFixed = isFrontCamera ? rawLeft : rawRight;

    leftSmooth = leftSmooth * (1 - SMOOTH_ALPHA) + leftRawFixed * SMOOTH_ALPHA;
    rightSmooth = rightSmooth * (1 - SMOOTH_ALPHA) + rightRawFixed * SMOOTH_ALPHA;

    const startThreshold = cfg.eyeClosedThreshold;
    const stopThreshold = Math.min(1, startThreshold + STOP_THRESHOLD_OFFSET);

    const eyesClosedNow = leftSmooth < startThreshold || rightSmooth < startThreshold;
    const eyesOpenNow = leftSmooth > stopThreshold && rightSmooth > stopThreshold;

    if (state.alarmPlaying) {
      set({
        faceDetected: true,
        leftEyeOpen: leftSmooth,
        rightEyeOpen: rightSmooth,
        isEyesClosed: eyesClosedNow,
        eyesClosedDuration: eyesClosedSince ? now - eyesClosedSince : 0,
      });
      return;
    }

    if (eyesOpenNow) {
      eyesClosedSince = null;
      set({
        faceDetected: true,
        leftEyeOpen: leftSmooth,
        rightEyeOpen: rightSmooth,
        isEyesClosed: false,
        eyesClosedDuration: 0,
      });
      return;
    }

    if (eyesClosedNow && eyesClosedSince == null) {
      eyesClosedSince = now;
    }

    const duration = eyesClosedSince ? now - eyesClosedSince : 0;

    set({
      faceDetected: true,
      leftEyeOpen: leftSmooth,
      rightEyeOpen: rightSmooth,
      isEyesClosed: true,
      eyesClosedDuration: duration,
    });

    if (!eyesClosedSince) return;

    const shouldTrigger = duration >= cfg.alarmAfterMs;

    if (shouldTrigger && !state.alarmPlaying && !triggering) {
      get().triggerAlarm();
    }
  },
}));