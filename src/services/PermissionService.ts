import { PermissionsAndroid, Platform, Alert } from 'react-native';
import * as Location from 'expo-location';

export const PermissionService = {
    requestAllPermissions: async () => {
        try {
            console.log('Requesting all permissions...');

            // 1. Request Location Permission (using Expo Location)
            const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
            console.log('Location permission status:', locationStatus);

            // 2. Request Microphone & Camera Permission
            if (Platform.OS === 'android') {
                const micGranted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                    {
                        title: 'Microphone Permission',
                        message: 'Oculus needs access to your microphone for the Voice Companion feature.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    },
                );
                console.log('Microphone permission status:', micGranted);

                const cameraGranted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                    {
                        title: 'Camera Permission',
                        message: 'Oculus needs access to your camera for drowsiness detection and flashlight.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    },
                );
                console.log('Camera permission status:', cameraGranted);
            }

            // 3. Request Notification Permission (Android 13+)
            if (Platform.OS === 'android' && Platform.Version >= 33) {
                const notificationGranted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
                    {
                        title: 'Notification Permission',
                        message: 'Oculus needs to show notifications for alerts.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    },
                );
                console.log('Notification permission status:', notificationGranted);
            }

            // 4. Request Phone Call Permission (For Emergency Calls)
            if (Platform.OS === 'android') {
                const callGranted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CALL_PHONE,
                    {
                        title: 'Phone Call Permission',
                        message: 'Oculus needs to make emergency calls directly.',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    },
                );
                console.log('Call Phone permission status:', callGranted);
            }

            return true;
        } catch (err) {
            console.warn('Error requesting permissions:', err);
            return false;
        }
    },

    checkMicrophonePermission: async () => {
        if (Platform.OS === 'android') {
            return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        }
        return true; // Assume true for iOS for now or implement iOS logic
    }
};
