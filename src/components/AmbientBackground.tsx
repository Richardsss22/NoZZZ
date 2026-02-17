import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../styles/theme';

interface AmbientBackgroundProps {
    colors: Theme;
    children: React.ReactNode;
}

export default function AmbientBackground({ colors, children }: AmbientBackgroundProps) {
    const { width, height } = useWindowDimensions();

    // Blobs animations
    const blob1Anim = useRef(new Animated.Value(0)).current;
    const blob2Anim = useRef(new Animated.Value(0)).current;
    const blob3Anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const createAnimation = (anim: Animated.Value, duration: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: 1,
                        duration,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration,
                        useNativeDriver: true,
                    }),
                ])
            );
        };

        createAnimation(blob1Anim, 15000).start();
        createAnimation(blob2Anim, 18000).start();
        createAnimation(blob3Anim, 20000).start();
    }, []);

    const getBlobStyle = (anim: Animated.Value, x: number, y: number, scaleRange: [number, number]) => {
        return {
            transform: [
                {
                    translateX: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, x],
                    }),
                },
                {
                    translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, y],
                    }),
                },
                {
                    scale: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: scaleRange,
                    }),
                },
            ],
        };
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={colors.background}
                style={StyleSheet.absoluteFill}
            />

            {colors.blobs.length > 0 && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Animated.View
                        style={[
                            styles.blob,
                            {
                                width: width * 1.2,
                                height: width * 1.2,
                                backgroundColor: colors.blobs[0],
                                top: -width * 0.4,
                                right: -width * 0.4,
                                opacity: 0.4,
                            },
                            getBlobStyle(blob1Anim, 50, -30, [1, 1.1]),
                        ]}
                    />
                    <Animated.View
                        style={[
                            styles.blob,
                            {
                                width: width,
                                height: width,
                                backgroundColor: colors.blobs[1],
                                bottom: height * 0.1,
                                left: -width * 0.3,
                                opacity: 0.3,
                            },
                            getBlobStyle(blob2Anim, -30, 50, [1, 0.9]),
                        ]}
                    />
                    <Animated.View
                        style={[
                            styles.blob,
                            {
                                width: width * 0.8,
                                height: width * 0.8,
                                backgroundColor: colors.blobs[2],
                                top: height * 0.3,
                                right: -width * 0.2,
                                opacity: 0.2,
                            },
                            getBlobStyle(blob3Anim, 30, 30, [1, 1.05]),
                        ]}
                    />
                </View>
            )}

            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    blob: {
        position: 'absolute',
        borderRadius: 1000,
        // Blur is hard in React Native without heavy libraries, 
        // but opacity + large size achieves a similar "ambient" effect.
    },
});
