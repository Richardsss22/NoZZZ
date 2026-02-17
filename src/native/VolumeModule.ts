import { NativeModules } from 'react-native';

interface VolumeModuleInterface {
  setMaxVolume(): Promise<string>;
  setMaxAlarmVolume(): Promise<string>;
  setMaxMusicVolume(): Promise<string>;
  playAlarm(): Promise<string>;
  stopAlarm(): Promise<string>;
  strobeFlashlight(): Promise<string>;
  stopStrobe(): Promise<string>;
  callPhone(number: string): Promise<string>;
  checkNotificationPolicyAccess(): Promise<boolean>;
  requestNotificationPolicyAccess(): void;
}

// Objeto bruto vindo do native
const raw = (NativeModules as any).VolumeModule || {};

const VolumeModule: VolumeModuleInterface = {
  setMaxVolume: () => {
    if (typeof raw.setMaxVolume === 'function') {
      const result = raw.setMaxVolume(); // pode ser void ou Promise
      return Promise.resolve(result ?? 'ok');
    }
    console.warn('[VolumeModule] setMaxVolume não está implementado no native.');
    return Promise.resolve('noop');
  },

  setMaxAlarmVolume: () => {
    if (typeof raw.setMaxAlarmVolume === 'function') {
      const result = raw.setMaxAlarmVolume();
      return Promise.resolve(result ?? 'ok');
    }
    console.warn('[VolumeModule] setMaxAlarmVolume não está implementado no native.');
    return Promise.resolve('noop');
  },

  setMaxMusicVolume: () => {
    if (typeof raw.setMaxMusicVolume === 'function') {
      const result = raw.setMaxMusicVolume();
      return Promise.resolve(result ?? 'ok');
    }
    console.warn('[VolumeModule] setMaxMusicVolume não está implementado no native.');
    return Promise.resolve('noop');
  },

  playAlarm: () => {
    if (typeof raw.playAlarm === 'function') {
      const result = raw.playAlarm();
      return Promise.resolve(result ?? 'ok');
    }
    console.warn('[VolumeModule] playAlarm não está implementado no native.');
    return Promise.resolve('noop');
  },

  stopAlarm: () => {
    if (typeof raw.stopAlarm === 'function') {
      const result = raw.stopAlarm();
      return Promise.resolve(result ?? 'ok');
    }
    if (typeof raw.stop === 'function') {
      console.warn('[VolumeModule] stopAlarm não existe, a usar raw.stop().');
      const result = raw.stop();
      return Promise.resolve(result ?? 'ok');
    }
    console.warn('[VolumeModule] stopAlarm/stop não estão implementados no native.');
    return Promise.resolve('noop');
  },

  strobeFlashlight: () => {
    if (typeof raw.strobeFlashlight === 'function') {
      const result = raw.strobeFlashlight();
      return Promise.resolve(result ?? 'ok');
    }
    console.warn('[VolumeModule] strobeFlashlight não está implementado no native.');
    return Promise.resolve('noop');
  },

  stopStrobe: () => {
    if (typeof raw.stopStrobe === 'function') {
      const result = raw.stopStrobe();
      return Promise.resolve(result ?? 'ok');
    }
    console.warn('[VolumeModule] stopStrobe não está implementado no native.');
    return Promise.resolve('noop');
  },

  checkNotificationPolicyAccess: () => {
    if (typeof raw.checkNotificationPolicyAccess === 'function') {
      const result = raw.checkNotificationPolicyAccess();
      return Promise.resolve(result);
    }
    console.warn('[VolumeModule] checkNotificationPolicyAccess não está implementado no native.');
    return Promise.resolve(false);
  },

  requestNotificationPolicyAccess: () => {
    if (typeof raw.requestNotificationPolicyAccess === 'function') {
      return raw.requestNotificationPolicyAccess();
    }
    console.warn('[VolumeModule] requestNotificationPolicyAccess não está implementado no native.');
  },

  callPhone: (number: string) => {
    if (typeof raw.callPhone === 'function') {
      return raw.callPhone(number);
    }
    console.warn('[VolumeModule] callPhone não está implementado no native.');
    return Promise.resolve('noop');
  },
};

export default VolumeModule;
