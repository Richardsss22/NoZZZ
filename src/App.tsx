import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Screens
import DashboardScreen from './screens/DashboardScreen';
import SettingsScreen from './screens/SettingsScreen';
import HistoryScreen from './screens/HistoryScreen';
import SensorScreen from './screens/SensorScreen';

// Services
import { useThemeStore, getTheme } from './styles/theme';
import { useI18nStore } from './i18n/i18nStore';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';



import { setupNotifications } from './services/NotificationService';

const Tab = createBottomTabNavigator();

export default function App() {
    const { isDarkMode, accent } = useThemeStore();
    const { loadLanguage } = useI18nStore();
    const colors = getTheme(isDarkMode, accent);

    useEffect(() => {
        loadLanguage();
        setupNotifications();
    }, []);

    return (
        <SafeAreaProvider>
            <NavigationContainer>
                <StatusBar style={isDarkMode ? 'light' : 'dark'} />
                <Tab.Navigator
                    screenOptions={({ route }) => ({
                        headerShown: false,
                        tabBarStyle: {
                            backgroundColor: colors.card,
                            borderTopColor: 'transparent',
                            position: 'absolute',
                            bottom: Platform.OS === 'ios' ? 35 : 20,
                            left: 15,
                            right: 15,
                            height: 70,
                            borderRadius: 25,
                            paddingBottom: 0,
                            ...colors.shadowLg,
                            borderWidth: 1,
                            borderColor: colors.border,
                            elevation: 10,
                        },
                        tabBarActiveTintColor: colors.accent,
                        tabBarInactiveTintColor: colors.textTertiary,
                        tabBarShowLabel: false,
                        tabBarItemStyle: {
                            height: 70,
                            paddingVertical: 10,
                        },
                        tabBarIcon: ({ focused, color, size }) => {
                            let iconName;

                            if (route.name === 'Dashboard') {
                                iconName = focused ? 'home' : 'home-outline';
                            } else if (route.name === 'Sensor') {
                                iconName = focused ? 'pulse' : 'pulse-outline';
                            } else if (route.name === 'History') {
                                iconName = focused ? 'stats-chart' : 'stats-chart-outline';
                            } else if (route.name === 'Settings') {
                                iconName = focused ? 'settings' : 'settings-outline';
                            }

                            return (
                                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                    {focused && (
                                        <View
                                            style={{
                                                position: 'absolute',
                                                top: -15,
                                                width: 6,
                                                height: 6,
                                                borderRadius: 3,
                                                backgroundColor: colors.accent,
                                                shadowColor: colors.accent,
                                                shadowOffset: { width: 0, height: 0 },
                                                shadowOpacity: 0.8,
                                                shadowRadius: 5,
                                            }}
                                        />
                                    )}
                                    <Ionicons name={iconName as any} size={28} color={color} />
                                </View>
                            );
                        },
                    })}
                >
                    <Tab.Screen name="Dashboard" component={DashboardScreen} />
                    <Tab.Screen name="Sensor" component={SensorScreen} />
                    <Tab.Screen name="History" component={HistoryScreen} />
                    <Tab.Screen name="Settings" component={SettingsScreen} />
                </Tab.Navigator>
            </NavigationContainer>
        </SafeAreaProvider>
    );
}
