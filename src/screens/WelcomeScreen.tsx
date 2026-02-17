import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore, getTheme } from '../styles/theme';
import { useI18nStore } from '../i18n/i18nStore';

export default function WelcomeScreen({ navigation }: any) {
    const [fadeAnim] = useState(new Animated.Value(0));
    const { isDarkMode } = useThemeStore();
    const { t } = useI18nStore();
    const colors = getTheme(isDarkMode);

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
        }).start();
    }, []);

    const handleStart = async () => {
        await AsyncStorage.setItem('hasSeenWelcome', 'true');
        navigation.replace('MainTabs');
    };

    return (
        <SafeAreaView style={styles.container}>
            <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                <Text style={styles.emoji}>🛡️</Text>
                <Text style={styles.title}>Bem-vindo ao</Text>
                <Text style={styles.appName}>Oculus</Text>
                <Text style={styles.subtitle}>
                    Sistema Inteligente de Deteção de Sonolência
                </Text>

                <View style={styles.features}>
                    <FeatureItem icon="👓" text="Monitorização em tempo real" />
                    <FeatureItem icon="⚠️" text="Alertas de sonolência" />
                    <FeatureItem icon="📞" text="Chamadas de emergência automáticas" />
                </View>

                <TouchableOpacity style={styles.button} onPress={handleStart}>
                    <Text style={styles.buttonText}>Começar</Text>
                </TouchableOpacity>

                <Text style={styles.version}>v0.1 - Protótipo</Text>
            </Animated.View>
        </SafeAreaView>
    );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
    return (
        <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>{icon}</Text>
            <Text style={styles.featureText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    emoji: {
        fontSize: 80,
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        color: '#AAAAAA',
        marginBottom: 10,
    },
    appName: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 15,
    },
    subtitle: {
        fontSize: 16,
        color: '#888888',
        textAlign: 'center',
        marginBottom: 50,
        paddingHorizontal: 20,
    },
    features: {
        width: '100%',
        marginBottom: 40,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: '#1A1A1A',
        padding: 15,
        borderRadius: 12,
    },
    featureIcon: {
        fontSize: 30,
        marginRight: 15,
    },
    featureText: {
        fontSize: 16,
        color: '#CCCCCC',
        flex: 1,
    },
    button: {
        backgroundColor: '#2196F3',
        paddingHorizontal: 60,
        paddingVertical: 18,
        borderRadius: 30,
        elevation: 5,
        shadowColor: '#2196F3',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    version: {
        position: 'absolute',
        bottom: 20,
        color: '#555555',
        fontSize: 12,
    },
});
