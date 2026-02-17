// src/screens/SettingsScreen.tsx

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Modal,
    Switch,
    Alert,
    Platform,
    Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useDrowsinessStore } from '../services/DrowsinessDetector';
import { useThemeStore, getTheme, Accent } from '../styles/theme';
import { useI18nStore } from '../i18n/i18nStore';
import { useCustomSettingsStore } from '../services/CustomSettingsStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCoffeeRadarStore } from '../services/CoffeeRadarService';
import { useEyeDetectionStore } from '../services/EyeDetectionService';
import { useVoiceCompanionStore } from '../services/VoiceCompanionService';
import { useSettingsStore } from '../services/SettingsStore';
import { useBLEStore } from '../services/BLEService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AmbientBackground from '../components/AmbientBackground';
import CameraViewComponent from '../components/CameraView';

const { width } = Dimensions.get('window');

export default function SettingsScreen() {
    const { emergencyContact, setEmergencyContact, loadSettings } = useDrowsinessStore();
    const {
        globalThreshold,
        setGlobalThreshold,
        startCalibration,
        isCalibrating,
        calibrationProgress
    } = useEyeDetectionStore();

    const { isDarkMode, toggleDarkMode, accent, setAccent } = useThemeStore();
    const { language, setLanguage, t } = useI18nStore();
    const { settings, isCustomMode, setCustomMode, updateSettings } = useCustomSettingsStore();
    const { settings: coffeeRadarSettings, updateSettings: updateCoffeeRadarSettings } = useCoffeeRadarStore();
    const { userName, setUserName: setStoreUserName } = useVoiceCompanionStore();
    const {
        isScanning,
        scannedDevices,
        isConnecting,
        connectedDevice,
        error: bleError,
        isConnected,
        startScanning,
        stopScanning,
        connect,
        disconnect,
        savedDevices,
        saveDevice,
        removeSavedDevice,
    } = useBLEStore();

    const [name, setName] = useState(userName);
    const [strobeEnabled, setStrobeEnabled] = useState(true);
    const colors = getTheme(isDarkMode, accent);
    const [contact, setContact] = useState(emergencyContact);
    const [showAbout, setShowAbout] = useState(false);
    const [operationMode, setOperationMode] = useState<'drive' | 'study' | 'custom'>(isCustomMode ? 'custom' : 'drive');

    useEffect(() => {
        loadSettings().then(() => {
            setContact(useDrowsinessStore.getState().emergencyContact);
        });
        setName(userName);
        setOperationMode(isCustomMode ? 'custom' : 'drive');
        AsyncStorage.getItem('strobe_enabled').then(val => {
            if (val === null) {
                setStrobeEnabled(true);
            } else {
                setStrobeEnabled(val === 'true');
            }
        });
    }, [isCustomMode, userName]);

    const handleModeChange = (mode: 'drive' | 'study' | 'custom') => {
        setOperationMode(mode);
        setCustomMode(mode === 'custom');
    };

    const handleSave = async () => {
        await setEmergencyContact(contact);
        setStoreUserName(name);
        await AsyncStorage.setItem('strobe_enabled', strobeEnabled.toString());
        Alert.alert(t('success'), t('settingsSaved'));
    };

    const renderAccentColor = (color: Accent, label: string) => {
        const isActive = accent === color;
        const colorValue = color === 'ocean' ? '#00D4FF' : color === 'blue' ? '#2196F3' : color === 'sunrise' ? '#FF9F0A' : '#333';

        return (
            <TouchableOpacity
                key={color}
                style={[styles.accentBox, { borderColor: isActive ? colors.accent : 'transparent' }]}
                onPress={() => setAccent(color)}
            >
                <View style={[styles.accentDot, { backgroundColor: colorValue }]} />
                <Text style={[styles.accentLabel, { color: isActive ? colors.text : colors.textTertiary }]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    const contrastColor = (isDarkMode && accent === 'black') ? '#000' : '#FFF';

    return (
        <AmbientBackground colors={colors}>
            <SafeAreaView style={styles.container}>
                {/* HEADER */}
                <View style={styles.headerGlass}>
                    <View style={styles.headerContent}>
                        <View style={styles.headerLeft}>
                            <LinearGradient
                                colors={[colors.accent, colors.accentDark]}
                                style={styles.appIcon}
                            >
                                <Ionicons name="settings" size={24} color={contrastColor} />
                            </LinearGradient>
                            <View>
                                <Text style={[styles.appTitle, { color: colors.text }]}>{t('settings')}</Text>
                                <Text style={[styles.appSubtitle, { color: colors.textTertiary }]}>{t('customizeExperience')}</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={[styles.saveBtnSmall, { backgroundColor: colors.accent }]}
                            onPress={handleSave}
                        >
                            <Ionicons name="save" size={20} color={isDarkMode && accent === 'black' ? '#000' : '#FFF'} />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* APPEARANCE SECTION */}
                    <Text style={[styles.sectionHeaderLabel, { color: colors.textTertiary }]}>{t('appearanceAndTheme')}</Text>
                    <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
                        <View style={styles.settingRow}>
                            <View>
                                <Text style={[styles.settingTitle, { color: colors.text }]}>{t('darkMode')}</Text>
                                <Text style={[styles.settingSub, { color: colors.textTertiary }]}>{t('optimizedForOled')}</Text>
                            </View>
                            <Switch
                                value={isDarkMode}
                                onValueChange={toggleDarkMode}
                                trackColor={{ false: '#767577', true: colors.accent }}
                                thumbColor={Platform.OS === 'ios' ? undefined : '#FFF'}
                            />
                        </View>

                        <View style={styles.divider} />

                        <Text style={[styles.settingTitle, { color: colors.text, marginBottom: 15 }]}>{t('accentColor')}</Text>
                        <View style={styles.accentGrid}>
                            {renderAccentColor('ocean', t('oceanLabel'))}
                            {renderAccentColor('blue', t('classicLabel'))}
                            {renderAccentColor('sunrise', t('sunriseLabel'))}
                            {isDarkMode && renderAccentColor('black', t('pretoLabel'))}
                        </View>

                        <View style={styles.divider} />

                        <Text style={[styles.settingTitle, { color: colors.text, marginBottom: 15 }]}>{t('language')}</Text>
                        <View style={styles.langGrid}>
                            <TouchableOpacity
                                style={[styles.langBtnTab, language === 'pt' ? { backgroundColor: colors.accentLight, borderColor: colors.accent } : { borderColor: colors.border }]}
                                onPress={() => setLanguage('pt')}
                            >
                                <Text style={[styles.langBtnText, { color: language === 'pt' ? colors.accent : colors.textTertiary }]}>Português</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.langBtnTab, language === 'en' ? { backgroundColor: colors.accentLight, borderColor: colors.accent } : { borderColor: colors.border }]}
                                onPress={() => setLanguage('en')}
                            >
                                <Text style={[styles.langBtnText, { color: language === 'en' ? colors.accent : colors.textTertiary }]}>English</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* SENSITIVITY SECTION */}
                    <Text style={[styles.sectionHeaderLabel, { color: colors.textTertiary }]}>{t('sensorsAndSensitivity')}</Text>
                    <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
                        <View style={styles.sliderBox}>
                            <View style={styles.sliderHeader}>
                                <Text style={[styles.settingTitle, { color: colors.text }]}>{t('eyeDetection')}</Text>
                                <Text style={[styles.sliderValue, { color: colors.accent }]}>{(globalThreshold * 100).toFixed(0)}%</Text>
                            </View>
                            <Slider
                                style={styles.premiumSlider}
                                minimumValue={0.10}
                                maximumValue={0.80}
                                step={0.01}
                                value={globalThreshold || 0.35}
                                onValueChange={setGlobalThreshold}
                                minimumTrackTintColor={colors.accent}
                                maximumTrackTintColor={colors.elevated}
                                thumbTintColor={colors.accent}
                            />
                            <View style={styles.sliderLabelsRow}>
                                <Text style={[styles.sliderHint, { color: colors.textTertiary }]}>{t('lessSensitive')}</Text>
                                <Text style={[styles.sliderHint, { color: colors.textTertiary }]}>{t('moreSensitive')}</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.accentLight, borderColor: colors.accent }]}
                            onPress={startCalibration}
                        >
                            <Ionicons name="scan" size={20} color={colors.accent} />
                            <Text style={[styles.actionBtnText, { color: colors.accent }]}>{t('calibrateAuto')}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* VOICE COMPANION */}
                    <Text style={[styles.sectionHeaderLabel, { color: colors.textTertiary }]}>{t('voiceCompanion')}</Text>
                    <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
                        <View style={styles.settingRow}>
                            <View>
                                <Text style={[styles.settingTitle, { color: colors.text }]}>{t('aiAssistant')}</Text>
                                <Text style={[styles.settingSub, { color: colors.textTertiary }]}>{t('voiceInteractions')}</Text>
                            </View>
                            <Switch
                                value={useVoiceCompanionStore((state: any) => state.isEnabled)}
                                onValueChange={(value) => useVoiceCompanionStore.getState().setEnabled(value)}
                                trackColor={{ false: '#767577', true: colors.accent }}
                            />
                        </View>

                        <View style={styles.divider} />

                        <Text style={[styles.settingTitle, { color: colors.text, marginBottom: 10 }]}>{t('whatToCallYou')}</Text>
                        <View style={[styles.inputContainer, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                            <Ionicons name="person" size={20} color={colors.accent} />
                            <TextInput
                                style={[styles.premiumInput, { color: colors.text }]}
                                value={name}
                                onChangeText={setName}
                                placeholder={t('yourNamePlaceholder')}
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>
                    </View>

                    {/* EMERGENCY CONTACT */}
                    <Text style={[styles.sectionHeaderLabel, { color: colors.textTertiary }]}>{t('safety')}</Text>
                    <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
                        <Text style={[styles.settingTitle, { color: colors.text, marginBottom: 10 }]}>{t('emergencyContact')}</Text>
                        <View style={[styles.inputContainer, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                            <Ionicons name="call" size={20} color={colors.danger} />
                            <TextInput
                                style={[styles.premiumInput, { color: colors.text }]}
                                value={contact}
                                onChangeText={setContact}
                                keyboardType="phone-pad"
                                placeholder="+351 9xx xxx xxx"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>
                        <Text style={[styles.settingSub, { color: colors.textTertiary, marginTop: 10 }]}>
                            {t('emergencyContactSub')}
                        </Text>
                    </View>

                    {/* BLUETOOTH GLASSES */}
                    <Text style={[styles.sectionHeaderLabel, { color: colors.textTertiary }]}>{t('hardware')}</Text>
                    <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
                        <View style={styles.hardwareRow}>
                            <View style={[styles.iconBox, { backgroundColor: isConnected ? colors.success + '20' : colors.elevated }]}>
                                <MaterialCommunityIcons name="glasses" size={24} color={isConnected ? colors.success : colors.textTertiary} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 15 }}>
                                <Text style={[styles.settingTitle, { color: colors.text }]}>{t('smartGlasses')}</Text>
                                <Text style={[styles.settingSub, { color: isConnected ? colors.success : colors.textTertiary }]}>
                                    {isConnected ? t('connected') : (isConnecting ? t('searching') : t('disconnected'))}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.hardwareBtn, { backgroundColor: isConnected ? colors.danger + '15' : colors.accentLight }]}
                                onPress={isConnected ? disconnect : startScanning}
                            >
                                <Ionicons
                                    name={isConnected ? "close-circle" : (isScanning ? "stop-circle" : "search")}
                                    size={20}
                                    color={isConnected ? colors.danger : colors.accent}
                                />
                            </TouchableOpacity>
                        </View>

                        {isScanning && (
                            <View style={styles.scanningBox}>
                                <Text style={[styles.scanningText, { color: colors.textTertiary }]}>{t('searchingDevices')}</Text>
                            </View>
                        )}

                        {scannedDevices.length > 0 && !isConnected && (
                            <View style={styles.deviceList}>
                                {scannedDevices.map((device: any) => (
                                    <TouchableOpacity
                                        key={device.id}
                                        style={[styles.deviceItem, { backgroundColor: colors.elevated, borderColor: colors.border }]}
                                        onPress={() => connect(device.id)}
                                    >
                                        <Ionicons name="bluetooth" size={20} color={colors.accent} />
                                        <Text style={[styles.deviceName, { color: colors.text }]}>{device.name || t('unknownDevice')}</Text>
                                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* ABOUT */}
                    <TouchableOpacity
                        style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 }, colors.shadow]}
                        onPress={() => setShowAbout(true)}
                    >
                        <View style={styles.aboutRow}>
                            <Ionicons name="information-circle" size={24} color={colors.accent} />
                            <Text style={[styles.settingTitle, { color: colors.text, marginLeft: 15 }]}>{t('aboutGlasses')}</Text>
                            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                        </View>
                    </TouchableOpacity>

                    <View style={{ height: 120 }} />
                </ScrollView>

                {/* MODALS */}
                <Modal visible={showAbout} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.modalIconBox, { backgroundColor: colors.accentLight }]}>
                                <Ionicons name="glasses" size={40} color={colors.accent} />
                            </View>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Oculus V1.0.RM</Text>
                            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
                                {language === 'pt'
                                    ? 'Sistema Inteligente de Deteção de Sonolência.\nDesenvolvido para salvar vidas na estrada.'
                                    : 'Intelligent Drowsiness Detection System.\nDeveloped to save lives on the road.'}
                            </Text>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.accent }]}
                                onPress={() => setShowAbout(false)}
                            >
                                <Text style={[styles.modalBtnText, { color: isDarkMode && accent === 'black' ? '#000' : '#FFF' }]}>{t('ok')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* CALIBRATION MODAL */}
                <Modal visible={isCalibrating} transparent={true} animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
                        <View style={styles.calibrationCameraContainer}>
                            <CameraViewComponent isPip={false} minimal={true} />
                        </View>
                        <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 20 }}>{t('lookAtCamera')}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, marginTop: 10 }}>{t('measuringAperture')}</Text>

                        <View style={styles.calibTrack}>
                            <LinearGradient
                                colors={[colors.accent, colors.accentDark]}
                                style={[styles.calibProgress, { width: `${calibrationProgress}%` }]}
                            />
                        </View>
                        <Text style={{ color: colors.accent, fontWeight: '800', marginTop: 15 }}>{calibrationProgress}%</Text>
                    </View>
                </Modal>
            </SafeAreaView>
        </AmbientBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
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
    saveBtnSmall: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 50,
    },
    sectionHeaderLabel: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 15,
        marginTop: 10,
    },
    premiumCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    settingSub: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginVertical: 15,
    },
    accentGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    accentBox: {
        alignItems: 'center',
        gap: 6,
        padding: 8,
        borderRadius: 12,
        borderWidth: 2,
        width: '23%',
    },
    accentDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    accentLabel: {
        fontSize: 10,
        fontWeight: '700',
    },
    langGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    langBtnTab: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    langBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
    sliderBox: {
        marginBottom: 15,
    },
    sliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    sliderValue: {
        fontSize: 16,
        fontWeight: '800',
    },
    premiumSlider: {
        width: '100%',
        height: 40,
    },
    sliderLabelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    sliderHint: {
        fontSize: 10,
        fontWeight: '600',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1,
        gap: 10,
    },
    actionBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 55,
        borderRadius: 14,
        borderWidth: 1,
        gap: 12,
    },
    premiumInput: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
    },
    hardwareRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 50,
        height: 50,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hardwareBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scanningBox: {
        marginTop: 15,
        alignItems: 'center',
    },
    scanningText: {
        fontSize: 12,
        fontWeight: '600',
    },
    deviceList: {
        marginTop: 15,
        gap: 8,
    },
    deviceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 12,
    },
    deviceName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
    },
    aboutRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalContent: {
        width: width * 0.8,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        alignItems: 'center',
    },
    modalIconBox: {
        width: 80,
        height: 80,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 10,
    },
    modalText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 25,
    },
    modalBtn: {
        paddingHorizontal: 40,
        paddingVertical: 12,
        borderRadius: 14,
    },
    modalBtnText: {
        color: '#FFF',
        fontWeight: '800',
        fontSize: 16,
    },
    calibTrack: {
        width: '80%',
        height: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 4,
        marginTop: 30,
        overflow: 'hidden',
    },
    calibProgress: {
        height: '100%',
        borderRadius: 4,
    },
    calibrationCameraContainer: {
        width: width * 0.7,
        height: width * 0.7,
        borderRadius: width * 0.35,
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: '#FFF',
    }
});
