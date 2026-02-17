import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../services/AuthStore';
import { useThemeStore, getTheme } from '../styles/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
    const { signInWithGoogle, loading } = useAuthStore();
    const { isDarkMode } = useThemeStore();
    const colors = getTheme(isDarkMode);
    const [signingIn, setSigningIn] = React.useState(false);

    const handleGoogleSignIn = async () => {
        setSigningIn(true);
        try {
            await signInWithGoogle();
        } catch (error: any) {
            alert('Erro ao fazer login: ' + error.message);
        } finally {
            setSigningIn(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                {/* App Logo/Title */}
                <View style={styles.header}>
                    <Text style={[styles.logo, { color: colors.primary }]}>👁️</Text>
                    <Text style={[styles.title, { color: colors.text }]}>Oculus</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Sistema Inteligente de Deteção de Sonolência
                    </Text>
                </View>

                {/* Sign In Button */}
                <View style={styles.buttonContainer}>
                    {signingIn || loading ? (
                        <ActivityIndicator size="large" color={colors.primary} />
                    ) : (
                        <TouchableOpacity
                            style={[styles.googleButton, { backgroundColor: '#FFF' }]}
                            onPress={handleGoogleSignIn}
                            activeOpacity={0.8}
                        >
                            <Image
                                source={{ uri: 'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }}
                                style={styles.googleLogo}
                            />
                            <Text style={styles.googleButtonText}>Entrar com Google</Text>
                        </TouchableOpacity>
                    )}

                    <Text style={[styles.hint, { color: colors.inactive }]}>
                        Faça login para sincronizar os seus dados
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 80,
    },
    logo: {
        fontSize: 80,
        marginBottom: 20,
    },
    title: {
        fontSize: 42,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center',
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 24,
        borderRadius: 50,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    googleLogo: {
        width: 24,
        height: 24,
        marginRight: 12,
    },
    googleButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000',
    },
    hint: {
        marginTop: 30,
        fontSize: 14,
        textAlign: 'center',
    },
});
