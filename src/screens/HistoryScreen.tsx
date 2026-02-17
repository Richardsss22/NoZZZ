// src/screens/HistoryScreen.tsx

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore, getTheme } from '../styles/theme';
import { useI18nStore } from '../i18n/i18nStore';
import { useTripHistoryStore } from '../services/TripHistoryStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AmbientBackground from '../components/AmbientBackground';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function HistoryScreen({ navigation }: any) {
  const { isDarkMode, accent } = useThemeStore();
  const colors = getTheme(isDarkMode, accent);
  const { t, language } = useI18nStore();

  const trips = useTripHistoryStore((state: any) => state.trips);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const tripsThisMonth = useMemo(
    () =>
      trips.filter((trip: any) => {
        const d = new Date(trip.startTime);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }),
    [trips, currentMonth, currentYear]
  );

  const statsAllTime = useMemo(() => {
    if (!trips.length) {
      return {
        totalKm: 0,
        totalDurationMin: 0,
        totalAlarms: 0,
        totalTrips: 0,
      };
    }

    let totalKm = 0;
    let totalDurationMs = 0;
    let totalAlarms = 0;

    trips.forEach((trip: any) => {
      totalKm += trip.distanceKm;
      totalAlarms += trip.alarmCount;
      const start = new Date(trip.startTime).getTime();
      const end = new Date(trip.endTime).getTime();
      totalDurationMs += Math.max(0, end - start);
    });

    return {
      totalKm,
      totalDurationMin: Math.round(totalDurationMs / 1000 / 60),
      totalAlarms,
      totalTrips: trips.length,
    };
  }, [trips]);

  const statsThisMonth = useMemo(() => {
    if (!tripsThisMonth.length) {
      return {
        totalKm: 0,
        totalDurationMin: 0,
        totalAlarms: 0,
        totalTrips: 0,
      };
    }

    let totalKm = 0;
    let totalDurationMs = 0;
    let totalAlarms = 0;

    tripsThisMonth.forEach((trip: any) => {
      totalKm += trip.distanceKm;
      totalAlarms += trip.alarmCount;
      const start = new Date(trip.startTime).getTime();
      const end = new Date(trip.endTime).getTime();
      totalDurationMs += Math.max(0, end - start);
    });

    return {
      totalKm,
      totalDurationMin: Math.round(totalDurationMs / 1000 / 60),
      totalAlarms,
      totalTrips: tripsThisMonth.length,
    };
  }, [tripsThisMonth]);

  const maxAlarms =
    trips.length > 0 ? Math.max(...trips.map((t: any) => t.alarmCount)) || 1 : 1;

  const formatDuration = (startIso: string, endIso: string) => {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const ms = Math.max(0, end - start);
    const totalSec = Math.round(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);

    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    return `${m} min`;
  };

  const formatTimeRange = (startIso: string, endIso: string) => {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const fmt = (d: Date) =>
      `${d.getHours().toString().padStart(2, '0')}:${d
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
    return `${fmt(start)} – ${fmt(end)}`;
  };

  const formatDateLabel = (iso: string) => {
    const d = new Date(iso);
    const hoje = new Date();
    const baseHoje = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate()
    ).getTime();
    const baseDia = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate()
    ).getTime();

    const diffMs = baseHoje - baseDia;
    const diffDias = diffMs / (1000 * 60 * 60 * 24);

    if (diffDias === 0) return t('today');
    if (diffDias === 1) return t('yesterday');

    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}`;
  };

  const monthLabel =
    language === 'pt'
      ? now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
      : now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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
                <Ionicons name="stats-chart" size={24} color={contrastColor} />
              </LinearGradient>
              <View>
                <Text style={[styles.appTitle, { color: colors.text }]}>{t('driveStats')}</Text>
                <Text style={[styles.appSubtitle, { color: colors.textTertiary }]}>{monthLabel}</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.reportBtnSmall, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="share-social" size={20} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* SUMMARY THIS MONTH */}
          <Text style={[styles.sectionHeaderLabel, { color: colors.textTertiary }]}>{t('monthlySummary')}</Text>

          <View style={styles.summaryGrid}>
            <View style={[styles.premiumSummaryCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
              <LinearGradient colors={[colors.accent + '10', 'transparent']} style={styles.cardGradient} />
              <Ionicons name="navigate" size={20} color={colors.accent} />
              <Text style={[styles.summaryValue, { color: colors.text }]}>{statsThisMonth.totalKm.toFixed(1)} <Text style={styles.unit}>km</Text></Text>
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>{t('distance')}</Text>
            </View>

            <View style={[styles.premiumSummaryCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
              <LinearGradient colors={[colors.accent + '10', 'transparent']} style={styles.cardGradient} />
              <Ionicons name="time" size={20} color={colors.accent} />
              <Text style={[styles.summaryValue, { color: colors.text }]}>{statsThisMonth.totalDurationMin} <Text style={styles.unit}>min</Text></Text>
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>{t('time')}</Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={[styles.premiumSummaryCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
              <LinearGradient colors={[colors.danger + '10', 'transparent']} style={styles.cardGradient} />
              <Ionicons name="warning" size={20} color={colors.danger} />
              <Text style={[styles.summaryValue, { color: statsThisMonth.totalAlarms > 0 ? colors.danger : colors.text }]}>{statsThisMonth.totalAlarms}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>{t('alarms')}</Text>
            </View>

            <View style={[styles.premiumSummaryCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
              <LinearGradient colors={[colors.accent + '10', 'transparent']} style={styles.cardGradient} />
              <Ionicons name="car" size={20} color={colors.accent} />
              <Text style={[styles.summaryValue, { color: colors.text }]}>{statsThisMonth.totalTrips}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>{t('trips')}</Text>
            </View>
          </View>

          {/* ALARMS PER TRIP CHART */}
          {trips.length > 0 && (
            <View style={[styles.premiumCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
              <Text style={[styles.statusLabel, { color: colors.textTertiary, marginBottom: 20 }]}>{t('alarmFreqPerTrip')}</Text>
              {trips.slice(0, 5).map((trip: any, index: number) => {
                const ratio = maxAlarms === 0 ? 0 : trip.alarmCount / maxAlarms;
                const barWidthPercent = Math.max(ratio * 100, 5);
                return (
                  <View key={trip.id} style={styles.barRow}>
                    <View style={styles.barInfo}>
                      <Text style={[styles.barTripTag, { color: colors.textTertiary }]}>#{trips.length - index}</Text>
                      <Text style={[styles.barDateTag, { color: colors.text }]}>{formatDateLabel(trip.startTime)}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barBase, { backgroundColor: colors.elevated }]} />
                      <LinearGradient
                        colors={trip.alarmCount > 0 ? [colors.danger, colors.danger + 'AA'] : [colors.accent, colors.accentDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.barFill, { width: `${barWidthPercent}%` }]}
                      />
                    </View>
                    <Text style={[styles.barCount, { color: trip.alarmCount > 0 ? colors.danger : colors.textTertiary }]}>{trip.alarmCount}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* RECENT TRIPS LIST */}
          <Text style={[styles.sectionHeaderLabel, { color: colors.textTertiary, marginTop: 10 }]}>{t('recentTrips')}</Text>

          {trips.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="leaf-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Ainda não há viagens registadas.</Text>
            </View>
          ) : (
            trips.map((trip: any) => (
              <View key={trip.id} style={[styles.tripCard, { backgroundColor: colors.card, borderColor: colors.border }, colors.shadow]}>
                <View style={styles.tripHeader}>
                  <View style={styles.tripDateBox}>
                    <Text style={[styles.tripDateDay, { color: colors.text }]}>{formatDateLabel(trip.startTime)}</Text>
                    <Text style={[styles.tripDateTime, { color: colors.textTertiary }]}>{formatTimeRange(trip.startTime, trip.endTime)}</Text>
                  </View>
                  <View style={[styles.tripDurationBadge, { backgroundColor: colors.elevated }]}>
                    <Ionicons name="stopwatch-outline" size={14} color={colors.accent} />
                    <Text style={[styles.tripDurationText, { color: colors.textSecondary }]}>{formatDuration(trip.startTime, trip.endTime)}</Text>
                  </View>
                </View>

                <View style={[styles.tripStatsGrid, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
                  <View style={styles.tripStat}>
                    <Text style={[styles.tripStatLabel, { color: colors.textTertiary }]}>{t('distanceLabel')}</Text>
                    <Text style={[styles.tripStatValue, { color: colors.text }]}>{trip.distanceKm.toFixed(1)} <Text style={styles.unitSmall}>km</Text></Text>
                  </View>
                  <View style={[styles.tripStatDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.tripStat}>
                    <Text style={[styles.tripStatLabel, { color: colors.textTertiary }]}>{t('avgSpeed')}</Text>
                    <Text style={[styles.tripStatValue, { color: colors.text }]}>{Math.round(trip.avgSpeedKmh)} <Text style={styles.unitSmall}>km/h</Text></Text>
                  </View>
                  <View style={[styles.tripStatDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.tripStat}>
                    <Text style={[styles.tripStatLabel, { color: colors.textTertiary }]}>{t('maxSpeed')}</Text>
                    <Text style={[styles.tripStatValue, { color: colors.text }]}>{Math.round(trip.maxSpeedKmh)} <Text style={styles.unitSmall}>km/h</Text></Text>
                  </View>
                </View>

                <View style={styles.tripFooter}>
                  <View style={[styles.alarmSummary, { backgroundColor: trip.alarmCount > 0 ? colors.danger + '15' : colors.success + '15' }]}>
                    <Ionicons
                      name={trip.alarmCount > 0 ? "alert-circle" : "checkmark-circle"}
                      size={16}
                      color={trip.alarmCount > 0 ? colors.danger : colors.success}
                    />
                    <Text style={[styles.alarmSummaryText, { color: trip.alarmCount > 0 ? colors.danger : colors.success }]}>
                      {trip.alarmCount === 0 ? t('safeDriving') : t('attentionAlarms').replace('{count}', trip.alarmCount)}
                    </Text>
                  </View>
                  <TouchableOpacity>
                    <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* GLOBAL SUMMARY */}
          <View style={{ backgroundColor: colors.accent, borderRadius: 24, padding: 24, marginTop: 20, marginBottom: 40 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 20, color: contrastColor }}>{t('globalSummary')}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: isDarkMode && accent === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)' }}>{t('totalDistance')}</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: contrastColor }}>{statsAllTime.totalKm.toFixed(1)} km</Text>
              </View>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: isDarkMode && accent === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)' }}>{t('totalTime')}</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: contrastColor }}>{statsAllTime.totalDurationMin} min</Text>
              </View>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
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
  reportBtnSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 80,
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  premiumSummaryCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  unit: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  premiumCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 10,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  barInfo: {
    width: 60,
  },
  barTripTag: {
    fontSize: 10,
    fontWeight: '700',
  },
  barDateTag: {
    fontSize: 12,
    fontWeight: '700',
  },
  barTrack: {
    flex: 1,
    height: 8,
    justifyContent: 'center',
  },
  barBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
    opacity: 0.5,
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  barCount: {
    fontSize: 12,
    fontWeight: '800',
    width: 20,
    textAlign: 'right',
  },
  tripCard: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  tripDateBox: {
    gap: 2,
  },
  tripDateDay: {
    fontSize: 16,
    fontWeight: '800',
  },
  tripDateTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  tripDurationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tripDurationText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tripStatsGrid: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    justifyContent: 'space-between',
  },
  tripStat: {
    flex: 1,
    alignItems: 'center',
  },
  tripStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tripStatValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  unitSmall: {
    fontSize: 10,
    fontWeight: '600',
  },
  tripStatDivider: {
    width: 1,
    height: 20,
    alignSelf: 'center',
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  alarmSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  alarmSummaryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
});
