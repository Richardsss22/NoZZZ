import React, { useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useBLEStore } from '../services/BLEService';
import { useThemeStore, getTheme } from '../styles/theme';
import { useI18nStore } from '../i18n/i18nStore';

interface BluetoothModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function BluetoothConnectionModal({ visible, onClose }: BluetoothModalProps) {
    const {
        scannedDevices,
        isScanning,
        startScanning,
        stopScanning,
        connect,
        isConnecting,
        connectingDeviceId
    } = useBLEStore();

    const { isDarkMode } = useThemeStore();
    const { t } = useI18nStore();
    const colors = getTheme(isDarkMode);

    useEffect(() => {
        if (visible) {
            startScanning();
        } else {
            stopScanning();
        }
    }, [visible]);

    const renderDeviceItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={[styles.deviceItem, { backgroundColor: colors.inputBg }]}
            onPress={() => {
                connect(item.id);
                onClose();
            }}
            disabled={isConnecting}
        >
            <View>
                <Text style={[styles.deviceName, { color: colors.text }]}>
                    {item.name || 'Unknown Device'}
                </Text>
                <Text style={[styles.deviceId, { color: colors.textSecondary }]}>
                    {item.id}
                </Text>
            </View>
            {isConnecting && connectingDeviceId === item.id && (
                <ActivityIndicator color={colors.primary} />
            )}
        </TouchableOpacity>
    );

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={[styles.modalView, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                        {t('connectGlasses')}
                    </Text>

                    {isScanning && (
                        <View style={styles.scanningContainer}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={[styles.scanningText, { color: colors.textSecondary }]}>
                                {t('searching')}...
                            </Text>
                        </View>
                    )}

                    <FlatList
                        data={scannedDevices}
                        renderItem={renderDeviceItem}
                        keyExtractor={item => item.id}
                        style={styles.list}
                        ListEmptyComponent={
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                {isScanning ? 'Scan active...' : 'No devices found.'}
                            </Text>
                        }
                    />

                    <TouchableOpacity
                        style={[styles.closeButton, { backgroundColor: colors.danger }]}
                        onPress={onClose}
                    >
                        <Text style={styles.closeButtonText}>{t('close')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        width: '85%',
        maxHeight: '70%',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    scanningContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    scanningText: {
        marginLeft: 10,
    },
    list: {
        marginBottom: 15,
    },
    deviceItem: {
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    deviceName: {
        fontWeight: 'bold',
        fontSize: 16,
    },
    deviceId: {
        fontSize: 12,
    },
    emptyText: {
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 20,
    },
    closeButton: {
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    closeButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});
