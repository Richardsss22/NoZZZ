import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEogBleStore } from '../services/EogBleService';
import { useBLEStore } from '../services/BLEService';
import { useThemeStore, getTheme } from '../styles/theme';
import { useI18nStore } from '../i18n/i18nStore';

export default function CalibrationButton() {
    const { connectedDevice } = useBLEStore();
    const { isDarkMode, accent } = useThemeStore();
    const { t } = useI18nStore();
    const colors = getTheme(isDarkMode, accent);

    const {
        phase,
        buttonLabel,
        countdownSec,
        statusText,
        attachToDevice,
        detach,
        pressMainButton,
    } = useEogBleStore();

    // Auto-attach when device is connected
    useEffect(() => {
        if (connectedDevice) {
            attachToDevice(connectedDevice);
        } else {
            detach();
        }
    }, [connectedDevice]);

    if (!connectedDevice) return null;

    const isAborting = (phase === 'calibrating' || phase === 'baseline' || phase === 'running');
    const buttonBg = isAborting ? colors.danger : colors.accent;
    const textColor = (isDarkMode && accent === 'black' && !isAborting) ? '#000' : '#FFF';

    return (
        <View style={styles.container}>
            {/* Show instructional text if present */}
            {!!statusText && (
                <Text style={[styles.statusText, { color: colors.text }]}>
                    {t(statusText as any)}
                    {typeof countdownSec === 'number' ? ` ${countdownSec}` : ''}
                </Text>
            )}

            <TouchableOpacity
                style={[
                    styles.button,
                    { backgroundColor: buttonBg }
                ]}
                onPress={pressMainButton}
            >
                <Text style={[styles.text, { color: textColor }]}>
                    {t(buttonLabel)}
                    {/* Hide countdown in button if it's already shown in statusText */}
                    {!statusText && typeof countdownSec === 'number' ? ` ${countdownSec}` : ''}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 10,
        alignItems: 'center',
    },
    statusText: {
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 8,
        textAlign: 'center',
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        minWidth: 200,
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    text: {
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    }
});
