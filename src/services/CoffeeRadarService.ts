import { create } from 'zustand';
import { useLocationStore } from './LocationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import axios from 'axios';
import { GOOGLE_MAPS_API_KEY as ENV_API_KEY } from '@env';

// User provided API Key
// User provided API Key
const GOOGLE_MAPS_API_KEY = ENV_API_KEY || 'AIzaSyA52VX6ytVKu0r3SXAB32hI3vq-ULCg-io';

export interface NearbyPlace {
    name: string;
    address: string;
    location: {
        lat: number;
        lng: number;
    };
    distance: number; // in km
    placeId: string;
    types: string[];
}

export interface CoffeeRadarSettings {
    enabled: boolean;
    searchRadiusKm: number;
    autoDismissSeconds: number;
}

interface CoffeeRadarState {
    settings: CoffeeRadarSettings;
    nearbyPlaces: NearbyPlace[];
    lastSuggestionTime: number | null;
    isSearching: boolean;
    error: string | null;

    // Actions
    loadSettings: () => Promise<void>;
    updateSettings: (settings: Partial<CoffeeRadarSettings>) => Promise<void>;
    searchNearbyPlaces: () => Promise<void>;
    dismissSuggestion: () => void;
    navigateToPlace: (place: NearbyPlace) => void;
    canShowSuggestion: () => boolean;
}

const DEFAULT_SETTINGS: CoffeeRadarSettings = {
    enabled: true,
    searchRadiusKm: 5,
    autoDismissSeconds: 30,
};

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export const useCoffeeRadarStore = create<CoffeeRadarState>((set, get) => ({
    settings: DEFAULT_SETTINGS,
    nearbyPlaces: [],
    lastSuggestionTime: null,
    isSearching: false,
    error: null,

    loadSettings: async () => {
        try {
            const saved = await AsyncStorage.getItem('coffeeRadarSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                set({ settings: { ...DEFAULT_SETTINGS, ...settings } });
            }
        } catch (e) {
            console.log('Error loading Coffee Radar settings:', e);
        }
    },

    updateSettings: async (newSettings: Partial<CoffeeRadarSettings>) => {
        const { settings } = get();
        const updated = { ...settings, ...newSettings };
        set({ settings: updated });
        await AsyncStorage.setItem('coffeeRadarSettings', JSON.stringify(updated));
    },

    canShowSuggestion: () => {
        const { settings } = get();

        if (!settings.enabled) {
            return false;
        }
        return true;
    },

    searchNearbyPlaces: async () => {
        const { settings, canShowSuggestion } = get();

        if (!canShowSuggestion()) {
            console.log('Cannot show suggestion yet (disabled or too soon)');
            return;
        }

        if (!GOOGLE_MAPS_API_KEY) {
            console.log('⚠️ Google Maps API key not configured.');
            set({
                error: 'API key not configured',
                isSearching: false
            });
            return;
        }

        set({ isSearching: true, error: null });

        try {
            const { location } = useLocationStore.getState();

            if (!location) {
                console.log('No location available');
                set({ isSearching: false, error: 'Location not available' });
                return;
            }

            const { latitude, longitude } = location.coords;
            const radiusMeters = settings.searchRadiusKm * 1000;

            console.log(`🔍 Searching for places within ${settings.searchRadiusKm}km using New Places API (v2)...`);

            const response = await axios.post(
                'https://places.googleapis.com/v1/places:searchNearby',
                {
                    includedTypes: ['cafe', 'coffee_shop', 'restaurant', 'gas_station'],
                    maxResultCount: 20,
                    locationRestriction: {
                        circle: {
                            center: {
                                latitude: latitude,
                                longitude: longitude
                            },
                            radius: radiusMeters
                        }
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
                        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types,places.id'
                    }
                }
            );

            const places = response.data.places || [];

            if (places.length === 0) {
                console.log('No nearby places found');
                set({ isSearching: false, error: 'No places found' });
                return;
            }

            const nearbyPlaces: NearbyPlace[] = places.map((place: any) => {
                const distance = calculateDistance(
                    latitude,
                    longitude,
                    place.location.latitude,
                    place.location.longitude
                );

                return {
                    name: place.displayName?.text || 'Unknown Place',
                    address: place.formattedAddress || '',
                    location: {
                        lat: place.location.latitude,
                        lng: place.location.longitude,
                    },
                    distance: Math.round(distance * 10) / 10,
                    placeId: place.id,
                    types: place.types || [],
                };
            });

            nearbyPlaces.sort((a, b) => a.distance - b.distance);
            const topPlaces = nearbyPlaces.slice(0, 8);

            console.log(`✅ Found ${topPlaces.length} places, closest: ${topPlaces[0].name} at ${topPlaces[0].distance}km`);

            set({
                nearbyPlaces: topPlaces,
                lastSuggestionTime: Date.now(),
                isSearching: false,
                error: null,
            });

        } catch (error: any) {
            console.log('❌ Error searching places:', error.response?.data || error.message);
            const apiError = error.response?.data?.error?.message || error.message;
            set({
                isSearching: false,
                error: apiError || 'Search failed'
            });
        }
    },

    dismissSuggestion: () => {
        console.log('Dismissing Coffee Radar suggestions');
        set({ nearbyPlaces: [] });
    },

    navigateToPlace: (place: NearbyPlace) => {
        console.log(`📍 Navigating to ${place.name}`);
        const url = `https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}&destination_place_id=${place.placeId}`;

        Linking.openURL(url).catch((err) => {
            console.log('Error opening maps:', err);
            const fallbackUrl = `https://maps.google.com/?q=${place.location.lat},${place.location.lng}`;
            Linking.openURL(fallbackUrl);
        });

        get().dismissSuggestion();
    },
}));

// Load settings on initialization
useCoffeeRadarStore.getState().loadSettings();
