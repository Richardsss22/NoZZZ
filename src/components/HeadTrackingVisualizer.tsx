import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import Svg, { G, Path, Ellipse, Circle } from 'react-native-svg';
import { useEogBleStore } from '../services/EogBleService';
import { useBLEStore } from '../services/BLEService';
import { useThemeStore, getTheme } from '../styles/theme';

export default function HeadTrackingVisualizer() {
    const liveRoll = useEogBleStore(state => state.liveRoll);
    const livePitch = useEogBleStore(state => state.livePitch);
    const device = useEogBleStore(state => state.device);
    const isTestMode = useEogBleStore(state => state.isTestMode);

    const connectedDevice = useBLEStore(state => state.connectedDevice);
    const gyroData = useBLEStore(state => state.gyroData);

    const { isDarkMode, accent } = useThemeStore();
    const colors = getTheme(isDarkMode, accent);

    const isConnected = !!device || !!connectedDevice || isTestMode;

    // Merge data from both stores - prioritize Radar (gyroData) over EOG (liveRoll/livePitch)
    const radarRoll = gyroData?.roll || 0;
    const radarPitch = gyroData?.pitch || 0;
    const eogRoll = liveRoll || 0;
    const eogPitch = livePitch || 0;
    const headYaw = radarRoll !== 0 ? radarRoll : eogRoll;
    const headPitch = radarPitch !== 0 ? radarPitch : eogPitch;

    const targetYaw = React.useRef(0);
    const targetPitch = React.useRef(0);

    // Update refs when values change
    useEffect(() => {
        targetYaw.current = headYaw;
        targetPitch.current = headPitch;
    }, [headYaw, headPitch]);

    // Smoothed values
    const [smoothYaw, setSmoothYaw] = useState(0);
    const [smoothPitch, setSmoothPitch] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setSmoothYaw(prev => {
                const diff = targetYaw.current - prev;
                if (Math.abs(diff) < 0.05) return targetYaw.current;
                return prev + diff * 0.22; // Slightly more responsive
            });
            setSmoothPitch(prev => {
                const diff = targetPitch.current - prev;
                if (Math.abs(diff) < 0.05) return targetPitch.current;
                return prev + diff * 0.22;
            });
        }, 16);
        return () => clearInterval(interval);
    }, []);

    const renderHead = () => {
        const yawFactor = smoothYaw / 60;
        const faceX = smoothYaw * 0.8;
        const faceY = -smoothPitch * 0.6; // Invertido: agora negativo = para baixo

        // --- CÁLCULO DE ESCALA DAS ORELHAS ---
        const leftEarScaleX = smoothYaw < 0 ? Math.max(0.2, 1 - (Math.abs(smoothYaw) * 0.03)) : 1;
        const rightEarScaleX = smoothYaw > 0 ? Math.max(0.2, 1 - (smoothYaw * 0.03)) : 1;

        // Olhos 3D
        const leftEyeScaleX = yawFactor < 0 ? 1 - (Math.abs(yawFactor) * 0.6) : 1 - (Math.abs(yawFactor) * 0.1);
        const rightEyeScaleX = yawFactor > 0 ? 1 - (Math.abs(yawFactor) * 0.6) : 1 - (Math.abs(yawFactor) * 0.1);

        // Nariz 3D (1.3 fator)
        const noseTipX = faceX * 1.3;
        const noseBaseW = 10;
        const centerlineCurve = faceX * 1.2;

        // --- BOCA 3D ---
        const mouthBaseW = 20;
        const mouthW_Left = smoothYaw < 0
            ? mouthBaseW * Math.max(0.4, 1 - Math.abs(smoothYaw) * 0.02)
            : mouthBaseW;
        const mouthW_Right = smoothYaw > 0
            ? mouthBaseW * Math.max(0.4, 1 - smoothYaw * 0.02)
            : mouthBaseW;

        // Oclusão
        const opacityLeftEar = smoothYaw < -30 ? 0 : 1;
        const opacityRightEar = smoothYaw > 30 ? 0 : 1;
        const noseSideLeftOpacity = smoothYaw < -30 ? 0 : 1;
        const noseSideRightOpacity = smoothYaw > 30 ? 0 : 1;

        // Colors
        const svgStroke = colors.text;
        const svgAccent = colors.accent;
        const svgFill = colors.card;
        const svgFillAccent = colors.accentLight;

        return (
            <Svg width="200" height="240" viewBox="-100 -120 200 240">
                {/* Pescoço */}
                <Path
                    d="M-30,90 Q-30,120 -50,140 M30,90 Q30,120 50,140"
                    stroke={svgStroke}
                    strokeWidth="2"
                    fill="none"
                    opacity={0.5}
                />

                {/* --- ORELHAS 3D --- */}
                {/* Orelha Esquerda */}
                <G transform={`translate(${faceX * 0.25}, ${faceY * 0.1})`} opacity={opacityLeftEar}>
                    <Path
                        d="M-80,-10 Q-95,10 -80,40"
                        stroke={svgStroke} fill={svgFill} strokeWidth="2"
                        transform={`scale(${leftEarScaleX} 1)`}
                    />
                </G>

                {/* Orelha Direita */}
                <G transform={`translate(${faceX * 0.25}, ${faceY * 0.1})`} opacity={opacityRightEar}>
                    <Path
                        d="M80,-10 Q95,10 80,40"
                        stroke={svgStroke} fill={svgFill} strokeWidth="2"
                        transform={`scale(${rightEarScaleX} 1)`}
                    />
                </G>

                {/* Crânio Base */}
                <Ellipse
                    cx="0" cy="0" rx="80" ry="95"
                    stroke={svgStroke}
                    strokeWidth="2.5"
                    fill={svgFill}
                />

                {/* Wireframe */}
                <G opacity={0.1}>
                    <Path d={`M-80,${faceY * 0.2} Q0,${faceY * 0.2 + 20} 80,${faceY * 0.2}`} stroke={svgStroke} fill="none" />
                    <Path d="M0,-95 Q0,0 0,95" stroke={svgStroke} fill="none" strokeDasharray="4 4" />
                </G>

                {/* GRUPO DO ROSTO */}
                <G transform={`translate(0, ${faceY})`}>
                    {/* Linha Central */}
                    <Path d={`M0,-95 Q${centerlineCurve},0 ${faceX * 0.8},95`} stroke={svgAccent} strokeWidth="1.5" strokeDasharray="3 3" opacity={0.4} fill="none" />

                    {/* Olhos */}
                    <G transform={`translate(${faceX - 25}, -10)`}>
                        <G transform={`scale(${leftEyeScaleX} 1)`}>
                            <Path d="M-10,0 L10,0" stroke={svgAccent} strokeWidth="2.5" strokeLinecap="round" />
                            <Circle cx="0" cy="0" r="3" fill={svgAccent} />
                        </G>
                    </G>

                    <G transform={`translate(${faceX + 25}, -10)`}>
                        <G transform={`scale(${rightEyeScaleX} 1)`}>
                            <Path d="M-10,0 L10,0" stroke={svgAccent} strokeWidth="2.5" strokeLinecap="round" />
                            <Circle cx="0" cy="0" r="3" fill={svgAccent} />
                        </G>
                    </G>

                    {/* NARIZ */}
                    <Path
                        d={`M${faceX},-15 Q${faceX},5 ${noseTipX},25`}
                        stroke={svgAccent} strokeWidth="2" fill="none" strokeLinecap="round"
                        transform="translate(0 5)"
                    />
                    <Path
                        d={`M${faceX - noseBaseW},20 L${noseTipX},25 L${faceX + noseBaseW},20`}
                        fill={svgFillAccent} stroke="none"
                        transform="translate(0 5)"
                    />
                    {/* Lateral ESQUERDA */}
                    <Path
                        d={`M${faceX - noseBaseW},20 L${noseTipX},25`}
                        stroke={svgAccent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        transform="translate(0 5)" opacity={noseSideLeftOpacity}
                    />
                    {/* Lateral DIREITA */}
                    <Path
                        d={`M${noseTipX},25 L${faceX + noseBaseW},20`}
                        stroke={svgAccent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        transform="translate(0 5)" opacity={noseSideRightOpacity}
                    />

                    {/* BOCA 3D */}
                    <Path
                        d={`M${faceX - mouthW_Left},50 Q${faceX},60 ${faceX + mouthW_Right},50`}
                        stroke={svgAccent}
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                    />
                </G>
            </Svg>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.visualizerBox}>
                {renderHead()}
            </View>
            <View style={styles.dataRow}>
                <View style={[styles.dataBadge, { backgroundColor: colors.accentLight, borderColor: colors.accent + '40' }]}>
                    <Text style={[styles.dataLabel, { color: colors.accent }]}>ROLL</Text>
                    <Text style={[styles.dataValue, { color: colors.text }]}>{smoothYaw.toFixed(0)}°</Text>
                </View>
                <View style={[styles.dataBadge, { backgroundColor: colors.accentLight, borderColor: colors.accent + '40' }]}>
                    <Text style={[styles.dataLabel, { color: colors.accent }]}>PITCH</Text>
                    <Text style={[styles.dataValue, { color: colors.text }]}>{smoothPitch.toFixed(0)}°</Text>
                </View>
            </View>
            {!isConnected && (
                <Text style={[styles.offlineText, { color: colors.textTertiary }]}>Aguardando conexão...</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    visualizerBox: {
        width: 200,
        height: 240,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dataRow: {
        flexDirection: 'row',
        gap: 20,
        marginTop: 10,
    },
    dataBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
    },
    dataLabel: {
        fontSize: 9,
        fontWeight: '800',
    },
    dataValue: {
        fontSize: 14,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    offlineText: {
        fontSize: 10,
        marginTop: 10,
        fontStyle: 'italic',
    }
});
