import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { useThemeStore, getTheme } from '../styles/theme';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useLocationStore } from '../services/LocationService';
import { useFocusEffect } from '@react-navigation/native';

export default function Compass() {
    const { isDarkMode, accent } = useThemeStore();
    const colors = getTheme(isDarkMode, accent);
    const { heading } = useLocationStore();

    // Iniciar bussola quando o ecrã está focado
    useFocusEffect(
        useCallback(() => {
            const store = useLocationStore.getState();
            store.startHeadingWatch();
            return () => {
                store.stopHeadingWatch();
            };
        }, [])
    );

    // Smooth rotation using Reanimated
    const rotation = useSharedValue(0);

    useEffect(() => {
        rotation.value = withSpring(-heading, {
            damping: 20,
            stiffness: 90,
            mass: 1,
        });
    }, [heading]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    const getDirectionText = (degrees: number) => {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
        const index = Math.round(((degrees %= 360) < 0 ? degrees + 360 : degrees) / 45) % 8;
        return directions[index];
    };

    const dialSize = 40;
    const center = dialSize / 2;

    return (
        <View style={styles.container}>
            {/* COMPASS DIAL */}
            <View style={[styles.dialWrapper, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                {/* Fixed Needle Marker (Top) */}
                <View style={styles.markerContainer}>
                    <Svg width="8" height="6" viewBox="0 0 12 14">
                        <Path d="M6 0L12 14H0L6 0Z" fill={colors.accent} />
                    </Svg>
                </View>

                <View style={[styles.innerDial, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f0f0f0' }]}>
                    <Animated.View style={[styles.cardinalContainer, { width: dialSize, height: dialSize }, animatedStyle]}>
                        <Svg width={dialSize} height={dialSize} viewBox={`0 0 ${dialSize} ${dialSize}`}>
                            {/* Ticks */}
                            {Array.from({ length: 24 }).map((_, i) => {
                                const deg = i * 15;
                                const isPrimary = deg % 90 === 0;
                                return (
                                    <Rect
                                        key={i}
                                        x={center - 0.5}
                                        y={1.5}
                                        width={1}
                                        height={isPrimary ? 4 : 2}
                                        fill={colors.textSecondary}
                                        opacity={isPrimary ? 0.8 : 0.4}
                                        transform={`rotate(${deg}, ${center}, ${center})`}
                                    />
                                );
                            })}
                        </Svg>

                        {/* Cardinal Labels */}
                        <Text style={[styles.cardinalText, { top: 3.5, color: colors.accent, fontWeight: '900', fontSize: 8 }]}>N</Text>
                        <Text style={[styles.cardinalText, { bottom: 3.5, color: colors.textSecondary, fontSize: 8 }]}>S</Text>
                        <Text style={[styles.cardinalText, { right: 3.5, top: '40%', color: colors.textSecondary, fontSize: 8, transform: [{ rotate: '90deg' }] }]}>E</Text>
                        <Text style={[styles.cardinalText, { left: 3.5, top: '40%', color: colors.textSecondary, fontSize: 8, transform: [{ rotate: '-90deg' }] }]}>O</Text>
                    </Animated.View>
                </View>

                {/* Center Pin */}
                <View style={[styles.centerPin, { backgroundColor: colors.accent }]} />
            </View>

            {/* STATUS DISPLAY - Moved Below */}
            <View style={styles.infoBox}>
                <Text style={[styles.directionText, { color: colors.accent }]}>
                    {getDirectionText(heading)}
                </Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.degreeText, { color: colors.text }]}>
                    {String(heading).padStart(3, '0')}°
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    dialWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    markerContainer: {
        position: 'absolute',
        top: 0,
        zIndex: 10,
    },
    innerDial: {
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerPin: {
        position: 'absolute',
        width: 3,
        height: 3,
        borderRadius: 1.5,
        zIndex: 5,
    },
    cardinalContainer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardinalText: {
        position: 'absolute',
        fontWeight: '700',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    directionText: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    degreeText: {
        fontSize: 9,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    divider: {
        width: 1,
        height: 8,
        opacity: 0.5,
    },
});
