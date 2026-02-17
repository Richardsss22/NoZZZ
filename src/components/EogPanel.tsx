import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEogBleStore } from '../services/EogBleService';

export default function EogPanel() {
  const {
    phase,
    buttonLabel,
    countdownSec,
    log,
    device,
    connect,
    disconnect,
    pressMainButton,
  } = useEogBleStore();

  const isConnected = !!device;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>ESP32 EOG</Text>

      {!isConnected ? (
        <TouchableOpacity style={styles.btn} onPress={connect}>
          <Text style={styles.btnText}>Ligar ao ESP32</Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity style={styles.btnSecondary} onPress={disconnect}>
            <Text style={styles.btnText}>Desligar</Text>
          </TouchableOpacity>

          <View style={{ height: 12 }} />

          <TouchableOpacity
            style={[styles.btn, (phase === 'error') && { opacity: 0.6 }]}
            onPress={pressMainButton}
          >
            <Text style={styles.btnText}>
              {buttonLabel}
              {typeof countdownSec === 'number' ? `  (${countdownSec}s)` : ''}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 12 }} />

          <Text style={styles.subtitle}>Log (últimas mensagens):</Text>
          <View style={styles.logBox}>
            {log.slice(0, 8).map((l, i) => (
              <Text key={i} style={styles.logLine} numberOfLines={1}>
                {l}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#333' },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 8, color: '#fff' },
  subtitle: { fontSize: 12, color: '#bbb', marginBottom: 6 },
  btn: { backgroundColor: '#2196F3', padding: 12, borderRadius: 10, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#555', padding: 10, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800' },
  logBox: { padding: 10, borderRadius: 10, backgroundColor: '#111' },
  logLine: { color: '#ddd', fontSize: 12, marginBottom: 4 },
});
