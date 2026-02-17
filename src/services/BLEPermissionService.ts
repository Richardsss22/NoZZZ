import { PermissionsAndroid, Platform } from 'react-native';

export interface BLEPermissionStatus {
    granted: boolean;
    message?: string;
}

/**
 * Request Bluetooth and Location permissions required for BLE scanning
 * @returns {Promise<BLEPermissionStatus>} Permission status
 */
export async function requestBLEPermissions(): Promise<BLEPermissionStatus> {
    if (Platform.OS !== 'android') {
        return { granted: true }; // iOS handles permissions differently
    }

    try {
        const androidVersion = Platform.Version;

        // Android 12+ (API 31+) requires new Bluetooth permissions
        if (androidVersion >= 31) {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            ]);

            const allGranted = Object.values(granted).every(
                (status) => status === PermissionsAndroid.RESULTS.GRANTED
            );

            if (!allGranted) {
                return {
                    granted: false,
                    message: 'Bluetooth and Location permissions are required for device scanning',
                };
            }
        } else {
            // Android 11 and below
            const locationGranted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );

            if (locationGranted !== PermissionsAndroid.RESULTS.GRANTED) {
                return {
                    granted: false,
                    message: 'Location permission is required for Bluetooth scanning',
                };
            }
        }

        return { granted: true };
    } catch (error) {
        console.error('Error requesting BLE permissions:', error);
        return {
            granted: false,
            message: 'Failed to request permissions: ' + error,
        };
    }
}

/**
 * Check if BLE permissions are already granted
 * @returns {Promise<boolean>} True if all required permissions are granted
 */
export async function checkBLEPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
        return true;
    }

    try {
        const androidVersion = Platform.Version;

        if (androidVersion >= 31) {
            const scanGranted = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
            );
            const connectGranted = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
            );
            const locationGranted = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );

            return scanGranted && connectGranted && locationGranted;
        } else {
            return await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );
        }
    } catch (error) {
        console.error('Error checking BLE permissions:', error);
        return false;
    }
}
