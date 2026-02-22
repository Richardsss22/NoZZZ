import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Animated, Easing, useWindowDimensions, Platform } from 'react-native';
import { useBLEStore } from '../services/BLEService';
import { useLocationStore } from '../services/LocationService';
import { useDrowsinessStore } from '../services/DrowsinessDetector';
import { useEyeDetectionStore } from '../services/EyeDetectionService';
import { useThemeStore, getTheme } from '../styles/theme';
import { useI18nStore } from '../i18n/i18nStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import CameraViewComponent from '../components/CameraView';
import { useCoffeeRadarStore, NearbyPlace } from '../services/CoffeeRadarService';
import CalibrationButton from '../components/CalibrationButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import AmbientBackground from '../components/AmbientBackground';

import { PermissionService } from '../services/PermissionService';
import VolumeModule from '../native/VolumeModule';
import { useVoiceCompanionStore } from '../services/VoiceCompanionService';
import { sendEmergencyNotification } from '../services/NotificationService';
import { useEogBleStore } from '../services/EogBleService';

import BluetoothConnectionModal from '../components/BluetoothConnectionModal';
import Compass from '../components/Compass';

export default function DashboardScreen({ navigation }: any) {
    const isConnected = useBLEStore(state => state.isConnected);
    const isScanning = useBLEStore(state => state.isScanning);
    const startScanning = useBLEStore(state => state.startScanning);
    const disconnect = useBLEStore(state => state.disconnect);
    const batteryLevel = useBLEStore(state => state.batteryLevel);

    const { isDriving, speed, startTracking, stopTracking } = useLocationStore();
    const { isDrowsy, resetAlert, countdown } = useDrowsinessStore();
    const {
        alarmPlaying,
        stopAlarm: stopEyeAlarm,
        suggestRestStop,
        dismissRestStop,
        isCameraActive,
        startCamera,
        stopCamera,
        callCountdown
    } = useEyeDetectionStore();

    const { nearbyPlaces, isSearching, dismissSuggestion, navigateToPlace, error } = useCoffeeRadarStore();
    const { isDarkMode, accent } = useThemeStore();
    const { t, language } = useI18nStore();
    const { triggerOnDemand, forceListen, isEnabled: isVoiceEnabled } = useVoiceCompanionStore();
    const colors = getTheme(isDarkMode, accent);

    const [modalVisible, setModalVisible] = useState(false);
    const { height } = useWindowDimensions(); // ADDED
    const isPip = height < 400; // ADDED

    // RED FLASH ANIMATION FOR DANGER MODAL
    const flashAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Start location tracking for speed and coffee radar
        startTracking();

        if (alarmPlaying) { // Trigger flash when alarm is playing
            Animated.loop(
                Animated.sequence([
                    Animated.timing(flashAnim, { toValue: 1, duration: 300, useNativeDriver: false, easing: Easing.linear }),
                    Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: false, easing: Easing.linear })
                ])
            ).start();
        } else {
            flashAnim.setValue(0);
        }
    }, [alarmPlaying]);

    const backgroundColorInterp = flashAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#FF0000', '#800000'] // Bright Red to Dark Red pulse
    });


    useEffect(() => {
        const init = async () => {
            await PermissionService.requestAllPermissions();
            // Initialize BLE and try to auto-connect
            const bleStore = useBLEStore.getState();
            await bleStore.initialize();
            await bleStore.connectToSavedDevices();

            // Load persisted settings (Emergency Contact)
            await useDrowsinessStore.getState().loadSettings();

            startTracking();

            // Check DND Permission (Android M+)
            try {
                const hasDndAccess = await VolumeModule.checkNotificationPolicyAccess();
                if (!hasDndAccess) {
                    // Ideally we show a dialog, but for now let's just log or request
                    // VolumeModule.requestNotificationPolicyAccess(); 
                    // Keeping it manual for now to avoid spamming the user on startup
                    console.log('⚠️ DND Access missing. Alarm might not override Silent mode.');
                }
            } catch (e) {
                console.log('Error checking DND:', e);
            }
        };
        init();
        return () => stopTracking();
    }, []);

    // --- ALARM LOGIC (Sync Drowsiness with EyeAlarm) ---
    // If EyeDetection triggers 'alarmPlaying', we consider the user in DANGER state.
    // We can also trigger notifications here if not driven by EyeDetectionService.
    useEffect(() => {
        if (alarmPlaying) {
            console.log('🚨 UI: ALARM IS PLAYING (Synced from EyeDetection)');
            sendEmergencyNotification().catch(console.error);
        }
    }, [alarmPlaying]);

    const handleStopAlarm = async () => {
        console.log('User stopping alarm...');
        await stopEyeAlarm(); // Stop siren + strobe + reset tracking
        try {
            await VolumeModule.stopAlarm();
            await VolumeModule.stopStrobe();
        } catch { }
    };
    const contrastColor = (isDarkMode && accent === 'black') ? '#000' : '#FFF';

    const renderGauge = (value: number) => {
        const radius = 52;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (Math.min(value, 200) / 200) * circumference;

        return (
            <View style={styles.gaugeContainer}>
                <Svg width="140" height="140" viewBox="0 0 120 120">
                    <Defs>
                        <SvgGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <Stop offset="0%" stopColor={colors.accent} stopOpacity="1" />
                            <Stop offset="100%" stopColor={colors.accentDark} stopOpacity="1" />
                        </SvgGradient>
                    </Defs>
                    <Circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        stroke={isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                        strokeWidth="10"
                        strokeDasharray={circumference}
                        transform="rotate(-90 60 60)"
                    />
                    <Circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        stroke="url(#gaugeGradient)"
                        strokeWidth="10"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                    />
                </Svg>
                <View style={styles.gaugeCenter}>
                    <Ionicons
                        name="speedometer-outline"
                        size={32}
                        color={value === 0 ? colors.textTertiary : colors.accent}
                        style={value === 0 ? styles.breathe : {}}
                    />
                </View>
            </View>
        );
    };

    return (
        <AmbientBackground colors={colors}>
            <SafeAreaView style={styles.container}>
                <View style={styles.headerGlass}>
                    <View style={styles.headerContent}>
                        <View style={styles.headerLeft}>
                            <LinearGradient
                                colors={[colors.accent, colors.accentDark]}
                                style={styles.appIcon}
                            >
                                <Ionicons name="eye" size={24} color={contrastColor} />
                            </LinearGradient>
                            <View>
                                <Text style={[styles.appTitle, { color: colors.text }]}>{t('appName')}</Text>
                                <Text style={[styles.appSubtitle, { color: colors.textTertiary }]}>Drive Intelligence</Text>
                            </View>
                        </View>
                        <View style={styles.headerRight}>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Settings')}
                                style={[styles.headerIconButton, { backgroundColor: colors.elevated }]}
                            >
                                <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                            <Compass />
                        </View>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Hero Card - Eye Detection */}
                    <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
                        <LinearGradient
                            colors={[colors.accent + '20', 'transparent']}
                            style={styles.cardGradient}
                        />
                        <View style={styles.cardHeader}>
                            <View>
                                <View style={styles.statusRow}>
                                    <View style={[styles.statusPulse, alarmPlaying ? { backgroundColor: colors.danger } : { backgroundColor: colors.success }]} />
                                    <Text style={[styles.statusLabel, { color: colors.textTertiary }]}>SISTEMA NEURAL</Text>
                                </View>
                                <Text style={[styles.heroTitle, { color: colors.text }]}>Deteção Ocular</Text>
                                <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>Pronto para monitorização</Text>
                            </View>
                            <LinearGradient
                                colors={[colors.accent, colors.accentDark]}
                                style={styles.heroIconBox}
                            >
                                <Ionicons name="videocam" size={28} color={contrastColor} />
                            </LinearGradient>
                        </View>

                        {isCameraActive && (
                            <View style={styles.cameraContainer}>
                                <CameraViewComponent isPip={false} minimal={true} />
                            </View>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.premiumBtn,
                                alarmPlaying ? { backgroundColor: colors.danger } : (isCameraActive ? { backgroundColor: colors.danger + '80' } : { backgroundColor: colors.accent })
                            ]}
                            onPress={() => {
                                if (alarmPlaying) {
                                    handleStopAlarm();
                                } else {
                                    if (isCameraActive) stopCamera();
                                    else startCamera();
                                }
                            }}
                        >
                            <LinearGradient
                                colors={['rgba(255,255,255,0.2)', 'transparent']}
                                style={StyleSheet.absoluteFill}
                            />
                            <Ionicons name={alarmPlaying ? "stop-circle" : (isCameraActive ? "videocam-off" : "videocam")} size={20} color={alarmPlaying ? '#FFF' : contrastColor} />
                            <Text style={[styles.premiumBtnText, { color: alarmPlaying ? '#FFF' : contrastColor }]}>
                                {alarmPlaying ? 'Parar Alarme' : (isCameraActive ? 'Desativar câmera' : 'Ativar câmera')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Connection Status */}
                    <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
                        <View style={styles.connectionRow}>
                            <View>
                                <Text style={[styles.statusLabel, { color: colors.textTertiary }]}>DISPOSITIVO EOG</Text>
                                <Text style={[styles.connectionStatus, { color: isConnected ? colors.accent : colors.danger }]}>
                                    {isConnected ? 'Conectado' : 'Desconectado'}
                                </Text>
                            </View>
                            <View style={styles.ringContainer}>
                                {isConnected && (
                                    <>
                                        <View style={[styles.connRing, { borderColor: colors.accent }]} />
                                        <View style={[styles.connRing, { borderColor: colors.accent }]} />
                                    </>
                                )}
                                <View style={[styles.connIconBox, { backgroundColor: isConnected ? colors.accentLight : colors.elevated }]}>
                                    <Ionicons name="bluetooth" size={24} color={isConnected ? colors.accent : colors.textTertiary} />
                                </View>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={[styles.secondaryBtn, { backgroundColor: colors.accentLight }]}
                            onPress={() => isConnected ? disconnect() : setModalVisible(true)}
                        >
                            <Ionicons name={isConnected ? "close-circle" : "link"} size={18} color={colors.accentDark} />
                            <Text style={[styles.secondaryBtnText, { color: colors.accentDark }]}>
                                {isConnected ? 'Desconectar' : 'Conectar Óculos'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Speed Monitor */}
                    <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
                        <View style={styles.speedRow}>
                            <View>
                                <Text style={[styles.statusLabel, { color: colors.textTertiary }]}>MONITOR DE VELOCIDADE</Text>
                                <View style={styles.speedValueRow}>
                                    <Text style={[styles.speedValue, { color: colors.text }]}>{Math.round(speed < 3.6 ? 0 : speed)}</Text>
                                    <Text style={[styles.speedUnit, { color: colors.textTertiary }]}>km/h</Text>
                                </View>
                                <View style={[styles.driveBadge, { backgroundColor: isDriving ? colors.accentLight : 'rgba(0,0,0,0.05)' }]}>
                                    <Text style={[styles.driveBadgeText, { color: isDriving ? colors.accentDark : colors.textSecondary }]}>
                                        {isDriving ? 'EM MOVIMENTO' : 'PARADO'}
                                    </Text>
                                </View>
                            </View>
                            {renderGauge(speed < 3.6 ? 0 : speed)}
                        </View>
                    </View>

                    {/* Quick Actions */}
                    <View style={styles.gridRow}>
                        <TouchableOpacity
                            style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}
                            onPress={triggerOnDemand}
                        >
                            <View style={[styles.gridIconBox, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                                <Ionicons name="mic-outline" size={24} color="#8b5cf6" />
                            </View>
                            <Text style={[styles.gridTitle, { color: colors.text }]}>{t('voiceCommands')}</Text>
                            <Text style={[styles.gridSubtitle, { color: colors.textTertiary }]}>{t('handsFree')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}
                            onPress={() => useVoiceCompanionStore.getState().setEnabled(!isVoiceEnabled)}
                        >
                            <View style={[styles.gridIconBox, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
                                <Ionicons name={isVoiceEnabled ? "volume-high" : "volume-mute"} size={24} color="#ec4899" />
                            </View>
                            <Text style={[styles.gridTitle, { color: colors.text }]}>{t('soundFeedback')}</Text>
                            <Text style={[styles.gridSubtitle, { color: colors.textTertiary }]}>{isVoiceEnabled ? t('active') : t('muted')}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Coffee Radar */}
                    <TouchableOpacity
                        style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}
                        onPress={() => useCoffeeRadarStore.getState().searchNearbyPlaces()}
                    >
                        <LinearGradient
                            colors={['#f97316' + '10', 'transparent']}
                            style={styles.cardGradient}
                        />
                        <View style={styles.coffeeRow}>
                            <View style={styles.coffeeLeft}>
                                <LinearGradient
                                    colors={['#fb923c', '#f59e0b']}
                                    style={styles.coffeeIconBox}
                                >
                                    <Ionicons name="cafe" size={24} color="#FFF" />
                                </LinearGradient>
                                <View>
                                    <Text style={[styles.gridTitle, { color: colors.text }]}>{t('coffeeRadar')}</Text>
                                    <Text style={[styles.gridSubtitle, { color: colors.textSecondary }]}>{t('findNearbyCoffee')}</Text>
                                </View>
                            </View>
                            <View style={[styles.arrowBox, { backgroundColor: colors.elevated }]}>
                                <Ionicons name={isSearching ? "refresh" : "location-sharp"} size={20} color="#f97316" />
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* Nearby Places List */}
                    {nearbyPlaces.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.placesScroll}>
                            {nearbyPlaces.map((place: NearbyPlace) => (
                                <TouchableOpacity
                                    key={place.placeId}
                                    style={[styles.placeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                                    onPress={() => navigateToPlace(place)}
                                >
                                    <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={1}>{place.name}</Text>
                                    <Text style={[styles.placeDist, { color: colors.accent }]}>{place.distance} km</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>

                {/* MODALS REMAINS FUNCTIONAL BUT HIDDEN IN MAIN RENDER */}
                <BluetoothConnectionModal visible={modalVisible} onClose={() => setModalVisible(false)} />

                {/* DANGER MODAL (Simplified Overlay) */}
                {alarmPlaying && (
                    <Modal visible={true} transparent={false} animationType="fade">
                        <Animated.View style={[styles.dangerOverlay, { backgroundColor: backgroundColorInterp }]}>
                            <Ionicons name="warning" size={100} color="#FFF" />
                            <Text style={styles.dangerOverlayTitle}>{t('danger')}</Text>
                            <Text style={styles.dangerSubtitle}>{t('eyesClosedWakeUp')}</Text>

                            <View style={styles.callCountdownBox}>
                                <Text style={styles.callCountdownLabel}>{t('emergencyCallIn')}:</Text>
                                <Text style={styles.callCountdownValue}>{callCountdown}s</Text>
                            </View>

                            <TouchableOpacity style={styles.dangerBtn} onPress={handleStopAlarm}>
                                <Text style={styles.dangerBtnText}>{t('stopAlarm')}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </Modal>
                )}
            </SafeAreaView>
        </AmbientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerGlass: {
        paddingTop: Platform.OS === 'ios' ? 0 : 20,
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    appIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    appTitle: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    appSubtitle: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: -2,
    },
    headerIconButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 80,
    },
    premiumCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        overflow: 'hidden',
    },
    cardGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 150,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    statusPulse: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    heroSubtitle: {
        fontSize: 13,
        fontWeight: '500',
    },
    heroIconBox: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 10,
    },
    cameraContainer: {
        height: 200,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
        backgroundColor: '#000',
    },
    premiumBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 16,
        overflow: 'hidden',
    },
    premiumBtnText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
    },
    connectionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    connectionStatus: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 4,
    },
    connectionDevice: {
        fontSize: 13,
        fontWeight: '500',
    },
    ringContainer: {
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    connRing: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 30,
        borderWidth: 2,
        opacity: 0,
    },
    connIconBox: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 14,
    },
    secondaryBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
    speedRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    speedValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
        marginBottom: 8,
    },
    speedValue: {
        fontSize: 56,
        fontWeight: '800',
        letterSpacing: -2,
    },
    speedUnit: {
        fontSize: 18,
        fontWeight: '600',
    },
    driveBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    driveBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    gaugeContainer: {
        width: 140,
        height: 140,
        alignItems: 'center',
        justifyContent: 'center',
    },
    gaugeCenter: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridRow: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 20,
    },
    gridItem: {
        flex: 1,
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
    },
    gridIconBox: {
        width: 50,
        height: 50,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    gridTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    gridSubtitle: {
        fontSize: 12,
        fontWeight: '500',
    },
    coffeeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    coffeeLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    coffeeIconBox: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrowBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    dangerOverlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    dangerOverlayTitle: {
        fontSize: 60,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 20,
        textAlign: 'center',
    },
    dangerSubtitle: {
        fontSize: 24,
        color: '#FFF',
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 40,
    },
    dangerBtn: {
        backgroundColor: '#FFF',
        paddingVertical: 20,
        paddingHorizontal: 40,
        borderRadius: 40,
    },
    dangerBtnText: {
        color: '#F43F5E',
        fontSize: 18,
        fontWeight: '900',
    },
    breathe: {
        // Opacity animation would go here
    },
    placesScroll: {
        marginTop: -10,
        marginBottom: 10,
        paddingLeft: 5,
    },
    placeCard: {
        width: 150,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        marginRight: 10,
    },
    placeName: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 4,
    },
    placeDist: {
        fontSize: 11,
        fontWeight: '800',
    },
    callCountdownBox: {
        alignItems: 'center',
        marginVertical: 30,
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 20,
        borderRadius: 20,
    },
    callCountdownLabel: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 5,
        opacity: 0.8,
    },
    callCountdownValue: {
        color: '#FFF',
        fontSize: 48,
        fontWeight: '900',
    }
});

