
import { View, Text, StyleSheet, Dimensions, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { useEogBleStore } from '../services/EogBleService';
import { useBLEStore } from '../services/BLEService';
import { useThemeStore, getTheme } from '../styles/theme';
import { useI18nStore } from '../i18n/i18nStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import CalibrationButton from '../components/CalibrationButton';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AmbientBackground from '../components/AmbientBackground';
import HeadTrackingVisualizer from '../components/HeadTrackingVisualizer';
import Compass from '../components/Compass';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function SensorScreen() {
    const { connectedDevice } = useBLEStore();
    const {
        device,
        phase,
        statusText,
        lastMinuteLabel,
        lastNormal,
        lastSlow,
        lastFlag,
        history,
        isTestMode,
        setIsTestMode,
    } = useEogBleStore();

    const { isDarkMode, accent } = useThemeStore();
    const { t, language } = useI18nStore();
    const colors = getTheme(isDarkMode, accent);
    const contrastColor = (isDarkMode && accent === 'black') ? '#000' : '#FFF';

    // Prepare chart data
    // We want to show Normal vs Slow over time
    // If history is empty, show dummy data to avoid crash or empty chart
    const dataPoints = history.length > 0 ? history : [{ minute: 0, normal: 0, slow: 0 }];

    // Take last 10 points for readability if needed, or show all
    const recentHistory = dataPoints.slice(-10);

    const labels = recentHistory.map(h => `M${h.minute}`);
    const normalData = recentHistory.map(h => h.normal);
    const slowData = recentHistory.map(h => h.slow);

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
                                <Ionicons name="pulse" size={24} color={contrastColor} />
                            </LinearGradient>
                            <View>
                                <Text style={[styles.appTitle, { color: colors.text }]}>Neural Analytics</Text>
                                <Text style={[styles.appSubtitle, { color: colors.textTertiary }]}>{t('biometricFeedback')}</Text>
                            </View>
                        </View>
                        <View style={styles.headerRight}>
                            <View style={[styles.statusBadge, { backgroundColor: !connectedDevice ? colors.elevated : colors.accentLight }]}>
                                <View style={[styles.dot, { backgroundColor: !connectedDevice ? colors.textTertiary : colors.accent }]} />
                                <Text style={[styles.statusBadgeText, { color: !connectedDevice ? colors.textSecondary : colors.accentDark }]}>
                                    {!connectedDevice ? t('offline') : t('online')}
                                </Text>
                            </View>
                            <Compass />
                        </View>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* 1. HEAD TRACKING SECTION */}
                    <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
                        <View style={styles.cardHeader}>
                            <View>
                                <Text style={[styles.statusLabel, { color: colors.textTertiary }]}>{t('motionSensor')}</Text>
                                <Text style={[styles.heroTitle, { color: colors.text, fontSize: 20 }]}>{t('cefalicMonitoring')}</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.testModeBtn, { backgroundColor: isTestMode ? colors.accent : colors.elevated }]}
                                onPress={() => setIsTestMode(!isTestMode)}
                            >
                                <Ionicons name="flask" size={18} color={isTestMode ? contrastColor : colors.textSecondary} />
                                <Text style={[styles.testModeText, { color: isTestMode ? contrastColor : colors.textSecondary }]}>TEST</Text>
                            </TouchableOpacity>
                        </View>
                        <HeadTrackingVisualizer />
                    </View>

                    {/* 2. CALIBRATION SECTION (Only when connected) */}
                    {connectedDevice && (
                        <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
                            <LinearGradient
                                colors={[colors.accent + '15', 'transparent']}
                                style={styles.cardGradient}
                            />

                            {/* Neural EOG Calibration */}
                            <CalibrationButton />

                            {statusText ? (
                                <View style={styles.feedbackBox}>
                                    <Ionicons name="information-circle" size={18} color={colors.accentDark} />
                                    <Text style={[styles.feedbackText, { color: colors.accentDark }]}>
                                        {statusText}
                                    </Text>
                                </View>
                            ) : (
                                <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                                    {t('adjustSensitivityHint')}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* 3. REAL-TIME STATS */}
                    {lastMinuteLabel && (
                        <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.statusLabel, { color: colors.textTertiary }]}>{t('lastMinute')}</Text>
                                <Text style={[styles.timeLabel, { color: colors.accent }]}>{lastMinuteLabel}</Text>
                            </View>

                            <View style={styles.statsGrid}>
                                <View style={styles.statBox}>
                                    <Text style={[styles.statValue, { color: colors.text }]}>{lastNormal}</Text>
                                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('normalBlinds')}</Text>
                                </View>
                                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                <View style={styles.statBox}>
                                    <Text style={[styles.statValue, { color: colors.danger }]}>{lastSlow}</Text>
                                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{t('slowBlinds')}</Text>
                                </View>
                                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                <View style={styles.statBox}>
                                    <View style={[styles.flagBadge, { backgroundColor: lastFlag === 'S-' ? colors.danger + '20' : colors.success + '20' }]}>
                                        <Text style={[styles.flagText, { color: lastFlag === 'S-' ? colors.danger : colors.success }]}>
                                            {lastFlag === 'S-' ? 'SONO' : 'OK'}
                                        </Text>
                                    </View>
                                    <Text style={[styles.statLabel, { color: colors.textTertiary, marginTop: 8 }]}>{t('currentStatus')}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* 4. CHART SECTION */}
                    <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
                        <Text style={[styles.statusLabel, { color: colors.textTertiary, marginBottom: 15 }]}>{t('analyticalHistory')}</Text>
                        <LineChart
                            data={{
                                labels: labels,
                                datasets: [
                                    {
                                        data: normalData,
                                        color: (opacity = 1) => colors.accent,
                                        strokeWidth: 3
                                    },
                                    {
                                        data: slowData,
                                        color: (opacity = 1) => colors.danger,
                                        strokeWidth: 3
                                    }
                                ],
                                legend: [t('legendNormal'), t('legendSlow')]
                            }}
                            width={SCREEN_WIDTH - 80}
                            height={220}
                            chartConfig={{
                                backgroundColor: 'transparent',
                                backgroundGradientFromOpacity: 0,
                                backgroundGradientToOpacity: 0,
                                decimalPlaces: 0,
                                color: (opacity = 1) => isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
                                labelColor: (opacity = 1) => colors.textTertiary,
                                propsForDots: {
                                    r: "4",
                                    strokeWidth: "2",
                                    stroke: colors.card
                                },
                                propsForLabels: {
                                    fontSize: 10,
                                    fontWeight: '600'
                                },
                                propsForBackgroundLines: {
                                    strokeDasharray: "5, 5",
                                    stroke: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
                                }
                            }}
                            bezier
                            style={{
                                marginVertical: 8,
                                borderRadius: 16
                            }}
                        />
                    </View>

                    {/* REPORT BUTTON */}
                    {history.length > 0 && (
                        <TouchableOpacity
                            style={styles.reportBtn}
                            onPress={() => useEogBleStore.getState().sendEmailReport()}
                        >
                            <LinearGradient
                                colors={[colors.accent, colors.accentDark]}
                                style={styles.reportBtnGradient}
                            >
                                <Ionicons name="mail-outline" size={20} color={contrastColor} />
                                <Text style={[styles.reportBtnText, { color: contrastColor }]}>{t('exportPdfReport')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeAreaView>
        </AmbientBackground >
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
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
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
    statusLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    heroIconBox: {
        width: 50,
        height: 50,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    testModeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    testModeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    feedbackBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        marginTop: 15,
    },
    feedbackText: {
        fontSize: 13,
        fontWeight: '600',
    },
    helperText: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 15,
        textAlign: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    timeLabel: {
        fontSize: 12,
        fontWeight: '700',
    },
    statsGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 14,
    },
    divider: {
        width: 1,
        height: 40,
        opacity: 0.5,
    },
    flagBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
    },
    flagText: {
        fontSize: 14,
        fontWeight: '800',
    },
    reportBtn: {
        marginBottom: 20,
        borderRadius: 16,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
            },
            android: {
                elevation: 6,
            }
        })
    },
    reportBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 18,
    },
    reportBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    miniDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginVertical: 15,
        width: '60%',
        alignSelf: 'center',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1,
        gap: 10,
        marginBottom: 10,
    },
    actionBtnText: {
        fontSize: 14,
        fontWeight: '700',
    },
});
