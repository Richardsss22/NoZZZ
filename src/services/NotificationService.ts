import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

// Configure notifications to show even when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export const setupNotifications = async () => {
    if (Platform.OS === 'android') {
        // Standard High Priority Channel (Best for Watch mirroring)
        await Notifications.setNotificationChannelAsync('smartwatch-standard', {
            name: 'Alerta de Sonolência',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 250, 500],
            lightColor: '#FF0000',
            bypassDnd: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            enableVibrate: true,
            sound: 'default',
        });
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
        console.log('❌ Notification permissions not granted!');
    }
};

export const sendEmergencyNotification = async () => {
    console.log('⌚ Sending Smartwatch Notification (Standard method)...');

    // Hardware vibration on phone
    Vibration.vibrate([0, 500, 500, 500]);

    await Notifications.scheduleNotificationAsync({
        content: {
            title: '🚨 ACORDA! 🚨',
            body: 'Deteção de fadiga crítica!',
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 500, 250, 500],
            color: '#FF0000',
            // Removed 'categoryIdentifier: alarm' to avoid watch filtering
            // @ts-ignore
            channelId: 'smartwatch-standard',
        },
        trigger: null,
    });
};
