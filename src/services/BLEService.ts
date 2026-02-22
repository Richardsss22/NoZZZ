import { create } from 'zustand';
import { BleManager, Device, State } from 'react-native-ble-plx';
import { requestBLEPermissions } from './BLEPermissionService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base64 helper (atob may not exist in React Native)
const b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
function atob_custom(input: string = '') {
    const str = input.replace(/=+$/, '');
    let output = '';
    if (str.length % 4 === 1) return '';
    let bc = 0, bs = 0, buffer = 0, i = 0;
    while (i < str.length) {
        buffer = b64chars.indexOf(str.charAt(i++));
        if (buffer === -1) continue;
        bs = bc % 4 ? bs * 64 + buffer : buffer;
        if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
    return output;
}

// Configuration
const CONFIG = {
    SERVICE_UUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
    GYRO_CHARACTERISTIC_UUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
    BATTERY_CHARACTERISTIC_UUID: '00002a19-0000-1000-8000-00805f9b34fb',
    AUTO_RECONNECT: true,
    RECONNECT_DELAY_MS: 3000,
};

const STORAGE_KEY = 'saved_ble_devices';

export interface GyroData {
    pitch: number;
    roll: number;
    yaw: number;
}

export interface ScannedDevice {
    id: string;
    name: string | null;
    rssi: number;
}

interface BLEState {
    isConnected: boolean;
    isScanning: boolean;
    isConnecting: boolean;
    connectingDeviceId: string | null;
    connectedDevice: Device | null;
    scannedDevices: ScannedDevice[];
    batteryLevel: number;
    gyroData: GyroData;
    rssi: number;
    error: string | null;
    lastError: string | null;
    savedDevices: string[]; // IDs dos dispositivos memorizados

    initialize: () => Promise<void>;
    startScanning: () => Promise<void>;
    stopScanning: () => void;
    connect: (deviceId: string) => Promise<void>;
    disconnect: () => void;
    clearError: () => void;
    saveDevice: (deviceId: string) => Promise<void>;
    removeSavedDevice: (deviceId: string) => Promise<void>;
    connectToSavedDevices: () => Promise<void>;
}

let bleManager: BleManager | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let gyroBuffer = ''; // Buffer to accumulate fragmented BLE packets

export const useBLEStore = create<BLEState>((set, get) => ({
    isConnected: false,
    isScanning: false,
    isConnecting: false,
    connectingDeviceId: null,
    connectedDevice: null,
    scannedDevices: [],
    batteryLevel: 100,
    gyroData: { pitch: 0, roll: 0, yaw: 0 },
    rssi: 0,
    error: null,
    lastError: null,
    savedDevices: [],

    initialize: async () => {
        try {
            if (bleManager) {
                console.log('✅ BLE Manager already initialized');
                return;
            }

            console.log('🔧 Initializing BLE Manager...');
            bleManager = new BleManager();

            const subscription = bleManager.onStateChange((state) => {
                console.log('📡 Bluetooth state:', state);
                if (state === State.PoweredOn) {
                    subscription.remove();
                    console.log('✅ Bluetooth is ready');
                } else if (state === State.PoweredOff) {
                    set({ error: 'Bluetooth desligado', isConnected: false });
                }
            }, true);

            // Load saved devices
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            if (saved) {
                set({ savedDevices: JSON.parse(saved) });
                console.log('📌 Dispositivos memorizados carregados:', JSON.parse(saved));
            }

            console.log('✅ BLE Manager initialized');
        } catch (error) {
            console.error('❌ BLE init error:', error);
            set({ error: `Erro ao inicializar BLE: ${error}` });
        }
    },

    startScanning: async () => {
        try {
            const { isScanning, isConnecting } = get();
            if (isScanning || isConnecting) return;

            const permissionResult = await requestBLEPermissions();
            if (!permissionResult.granted) {
                set({ error: permissionResult.message || 'Permissões negadas' });
                return;
            }

            if (!bleManager) await get().initialize();

            console.log('🔍 Scanning...');
            set({ isScanning: true, scannedDevices: [], error: null });

            const devices = new Map<string, ScannedDevice>();

            bleManager?.startDeviceScan(null, null, (error, device) => {
                if (error) {
                    console.error('❌ Scan error:', error);
                    set({ isScanning: false, error: `Erro no scan: ${error.message}` });
                    return;
                }

                if (device && device.name) {
                    devices.set(device.id, {
                        id: device.id,
                        name: device.name,
                        rssi: device.rssi || 0,
                    });
                    set({ scannedDevices: Array.from(devices.values()) });
                }
            });

            setTimeout(() => {
                if (get().isScanning) get().stopScanning();
            }, 10000);

        } catch (error) {
            console.error('❌ Scan failed:', error);
            set({ isScanning: false, error: `Scan falhou: ${error}` });
        }
    },

    stopScanning: () => {
        bleManager?.stopDeviceScan();
        set({ isScanning: false });
        console.log('🛑 Scan stopped');
    },

    connect: async (deviceId: string) => {
        try {
            const { isConnecting, isConnected } = get();
            if (isConnecting) return;
            if (isConnected) get().disconnect();

            get().stopScanning();

            console.log(`🔗 Connecting to: ${deviceId}...`);
            set({ isConnecting: true, connectingDeviceId: deviceId, error: null });

            if (!bleManager) throw new Error('BLE Manager not initialized');

            const device = await bleManager.connectToDevice(deviceId, {
                autoConnect: CONFIG.AUTO_RECONNECT,
            });

            console.log(`✅ Connected to: ${device.name}`);

            // Negotiate larger MTU to receive full JSON payloads (default BLE MTU is 20 bytes)
            try {
                await device.requestMTU(185);
                console.log('📏 MTU negotiated successfully');
            } catch (mtuErr) {
                console.log('⚠️ MTU negotiation failed (using default)');
            }

            await device.discoverAllServicesAndCharacteristics();

            set({
                isConnected: true,
                isConnecting: false,
                connectingDeviceId: null,
                connectedDevice: device,
                error: null
            });

            gyroBuffer = ''; // Reset buffer

            // Subscribe to gyro
            device.monitorCharacteristicForService(
                CONFIG.SERVICE_UUID,
                CONFIG.GYRO_CHARACTERISTIC_UUID,
                (error, characteristic) => {
                    if (error) {
                        console.error('❌ Gyro error:', error);
                        return;
                    }
                    if (characteristic?.value) {
                        try {
                            const decoded = atob_custom(characteristic.value);
                            gyroBuffer += decoded;

                            // Extract complete JSON objects from buffer
                            let openIdx = gyroBuffer.indexOf('{');
                            let closeIdx = gyroBuffer.indexOf('}');

                            while (openIdx !== -1 && closeIdx !== -1 && closeIdx > openIdx) {
                                const jsonStr = gyroBuffer.substring(openIdx, closeIdx + 1);
                                gyroBuffer = gyroBuffer.substring(closeIdx + 1);

                                try {
                                    const gyroData = JSON.parse(jsonStr);
                                    set({
                                        gyroData: {
                                            pitch: gyroData.pitch || 0,
                                            roll: gyroData.roll || 0,
                                            yaw: gyroData.yaw || 0,
                                        }
                                    });
                                } catch (_e) { /* skip malformed fragment */ }

                                openIdx = gyroBuffer.indexOf('{');
                                closeIdx = gyroBuffer.indexOf('}');
                            }

                            // Prevent buffer overflow
                            if (gyroBuffer.length > 500) gyroBuffer = '';
                        } catch (e) {
                            console.error('❌ Decode error:', e);
                        }
                    }
                }
            );

            // Subscribe to battery
            device.monitorCharacteristicForService(
                CONFIG.SERVICE_UUID,
                CONFIG.BATTERY_CHARACTERISTIC_UUID,
                (error, characteristic) => {
                    if (characteristic?.value) {
                        const battery = parseInt(atob(characteristic.value));
                        set({ batteryLevel: battery });
                    }
                }
            );

            // Monitor RSSI
            const rssiInterval = setInterval(async () => {
                if (get().isConnected && device) {
                    try {
                        const rssi = await device.readRSSI();
                        set({ rssi });
                    } catch (e) { }
                } else {
                    clearInterval(rssiInterval);
                }
            }, 2000);

            // Handle disconnect
            device.onDisconnected((error) => {
                console.log('🔌 Disconnected');
                set({ isConnected: false, connectedDevice: null });

                if (CONFIG.AUTO_RECONNECT && !error) {
                    console.log(`⏳ Reconnecting in ${CONFIG.RECONNECT_DELAY_MS / 1000}s...`);
                    reconnectTimeout = setTimeout(() => {
                        get().connect(deviceId);
                    }, CONFIG.RECONNECT_DELAY_MS);
                }
            });

        } catch (error) {
            console.error('❌ Connection failed:', error);
            set({
                isConnecting: false,
                connectingDeviceId: null,
                isConnected: false,
                error: `Conexão falhou: ${error}`
            });
        }
    },

    disconnect: () => {
        try {
            const { connectedDevice } = get();
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            if (connectedDevice) {
                console.log(`🔌 Disconnecting: ${connectedDevice.name}`);
                bleManager?.cancelDeviceConnection(connectedDevice.id);
            }

            // Ensure EOG service also detaches
            try {
                const { useEogBleStore } = require('./EogBleService');
                useEogBleStore.getState().detach();
            } catch (e) {
                console.log('EOG detach skip', e);
            }

            set({
                isConnected: false,
                isConnecting: false,
                connectingDeviceId: null,
                connectedDevice: null,
                gyroData: { pitch: 0, roll: 0, yaw: 0 }
            });
        } catch (error) {
            console.error('❌ Disconnect error:', error);
        }
    },

    saveDevice: async (deviceId: string) => {
        try {
            const { savedDevices } = get();

            // Limitar a 2 dispositivos
            let newSaved = [...savedDevices];
            if (!newSaved.includes(deviceId)) {
                newSaved.push(deviceId);
                if (newSaved.length > 2) {
                    newSaved = newSaved.slice(-2); // Manter apenas os 2 últimos
                }
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSaved));
                set({ savedDevices: newSaved });
                console.log('💾 Dispositivo memorizado:', deviceId);
            }
        } catch (error) {
            console.error('❌ Save device error:', error);
        }
    },

    removeSavedDevice: async (deviceId: string) => {
        try {
            const { savedDevices } = get();
            const newSaved = savedDevices.filter(id => id !== deviceId);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSaved));
            set({ savedDevices: newSaved });
            console.log('🗑️ Dispositivo removido:', deviceId);
        } catch (error) {
            console.error('❌ Remove device error:', error);
        }
    },

    connectToSavedDevices: async () => {
        try {
            const { savedDevices } = get();
            if (savedDevices.length === 0) {
                console.log('ℹ️ Nenhum dispositivo memorizado');
                return;
            }

            console.log('🔄 Conectando aos dispositivos memorizados...');

            // Por agora, conecta ao primeiro dispositivo salvo
            // TODO: Suporte para múltiplos dispositivos simultâneos
            if (savedDevices[0]) {
                await get().connect(savedDevices[0]);
            }
        } catch (error) {
            console.error('❌ Connect to saved error:', error);
        }
    },

    clearError: () => set({ error: null }),
}));
