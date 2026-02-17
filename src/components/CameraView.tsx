import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  runAtTargetFps
} from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';

import { useEyeDetectionStore } from '../services/EyeDetectionService';
import { useThemeStore, getTheme } from '../styles/theme';
import { useI18nStore } from '../i18n/i18nStore';

interface Props {
  isPip?: boolean;
  minimal?: boolean;
}

export default function CameraViewComponent({ isPip = false, minimal = false }: Props) {
  const {
    isCameraActive,
    alarmPlaying,
    startCamera,
    pauseCamera,
    stopCamera,
    stopAlarm,
    updateFaceData,
    isEyesClosed,
    eyesClosedDuration,
    leftEyeOpen,
    rightEyeOpen,
    isNightRun
  } = useEyeDetectionStore();

  const { isDarkMode } = useThemeStore();
  const { t } = useI18nStore();
  const colors = getTheme(isDarkMode);

  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  const { detectFaces } = useFaceDetector({
    performanceMode: 'fast',
    landmarkMode: 'all',
    contourMode: 'all',
    classificationMode: 'all',
    minFaceSize: 0.15,
  });

  useEffect(() => {
    if (!hasPermission) requestPermission();

    // IMPORTANTE: não usar stopCamera() no unmount, senão pára o alarme.
    return () => {
      pauseCamera();
    };
  }, []);

  const handleStartCamera = async () => {
    if (hasPermission) startCamera();
    else await requestPermission();
  };

  const onFaceDetectedJS = Worklets.createRunOnJS((faces: any[]) => {
    updateFaceData(faces, device?.position === 'front');
  });

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      runAtTargetFps(5, () => {
        const faces = detectFaces(frame);
        onFaceDetectedJS(faces);
      });
    },
    [detectFaces, onFaceDetectedJS]
  );

  if (!hasPermission) {
    if (minimal) return <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#FFF' }}>S/ Permissão</Text></View>;
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>👁️ {t('eyeDetection')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('cameraDescription')}</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Request Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    if (minimal) return <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="small" color="#FFF" /></View>;
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.subtitle, { color: colors.textSecondary, marginTop: 10 }]}>
          {t('searching') || 'Searching camera...'}
        </Text>
      </View>
    );
  }

  // ✅ Estado “alarme ativo”
  if (alarmPlaying) {
    if (minimal) return <View style={{ flex: 1, backgroundColor: colors.danger, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>ALARME!</Text></View>;
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>🚨 ALARME ATIVO</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          O alarme está a tocar. Carrega para parar.
        </Text>

        <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopAlarm}>
          <Text style={styles.buttonText}>Parar alarme</Text>
        </TouchableOpacity>

        <View style={{ height: 10 }} />

        <TouchableOpacity style={styles.button} onPress={handleStartCamera}>
          <Text style={styles.buttonText}>{t('activateCamera')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isCameraActive) {
    if (minimal) return <View style={{ flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }}><Ionicons name="videocam-off" size={32} color="rgba(255,255,255,0.3)" /></View>;
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>👁️ {t('eyeDetection')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('cameraDescription')}</Text>
        <TouchableOpacity style={styles.button} onPress={handleStartCamera}>
          <Text style={styles.buttonText}>{t('activateCamera')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if ((isPip || minimal) && isCameraActive && !alarmPlaying) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          frameProcessor={frameProcessor}
          pixelFormat="yuv"
        />
        <View style={styles.overlay}>
          <View style={[styles.statusBox, { backgroundColor: isEyesClosed ? 'rgba(255, 59, 48, 0.9)' : 'rgba(0,0,0,0.5)', padding: 5 }]}>
            {isEyesClosed && <Text style={{ fontSize: 40 }}>⚠️</Text>}
            <Text style={{ color: 'white', fontWeight: 'bold' }}>
              {isEyesClosed ? 'ALERT' : 'ACTIVE'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>👁️ {t('cameraActive')}</Text>

      <View style={styles.cameraContainer}>
        <Camera
          style={styles.camera}
          device={device}
          isActive={isCameraActive && !alarmPlaying}
          frameProcessor={frameProcessor}
          pixelFormat="yuv"
        />

        {/* NIGHT MODE RING LIGHT */}
        {isNightRun && (
          <View style={{
            ...StyleSheet.absoluteFillObject,
            borderWidth: 50,
            borderColor: 'rgba(255,255,255,0.7)',
            zIndex: 10,
            pointerEvents: 'none'
          }} />
        )}

        <View style={styles.overlay}>
          <View
            style={[
              styles.statusBox,
              { backgroundColor: isEyesClosed ? 'rgba(255, 59, 48, 0.9)' : 'rgba(0, 0, 0, 0.7)' }
            ]}
          >
            <Text style={styles.overlayText}>
              {isEyesClosed ? '⚠️ OLHOS FECHADOS' : '✓ Olhos Abertos'}
            </Text>

            {isEyesClosed && (
              <Text style={styles.timerText}>
                {Math.max(0, (2500 - eyesClosedDuration) / 1000).toFixed(1)}s
              </Text>
            )}

            <View style={styles.eyeData}>
              <Text style={styles.eyeText}>L: {(leftEyeOpen * 100).toFixed(0)}%</Text>
              <Text style={styles.eyeText}>R: {(rightEyeOpen * 100).toFixed(0)}%</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopCamera}>
        <Text style={styles.buttonText}>{t('deactivateCamera')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 15,
    lineHeight: 20,
  },
  cameraContainer: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
    position: 'relative',
  },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
  },
  statusBox: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  overlayText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  timerText: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 5,
  },
  eyeData: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 5,
  },
  eyeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});