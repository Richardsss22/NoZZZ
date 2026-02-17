import { create } from 'zustand';
import * as Speech from 'expo-speech';
import Voice, { SpeechResultsEvent } from '@react-native-voice/voice';
import AsyncStorage from '@react-native-async-storage/async-storage';

type VoiceMode = 'challenge' | 'companion' | 'off';

interface VoiceCompanionState {
    isEnabled: boolean;
    mode: VoiceMode;
    intervalMinutes: number;
    lastInteractionTime: number;
    isSpeaking: boolean;
    isListening: boolean;
    userName: string;
    selectedVoice: string | null;

    // Actions
    setEnabled: (enabled: boolean) => void;
    setMode: (mode: VoiceMode) => void;
    setIntervalMinutes: (minutes: number) => void;
    setUserName: (name: string) => void;
    startSession: () => void;
    stopSession: () => void;
    triggerInteraction: () => void;
    triggerOnDemand: () => void;
    forceListen: () => void;

    // Internal
    startListening: () => Promise<void>;
    stopListening: () => Promise<void>;
}

// --- Vocabulary & Gender Logic ---

const getGenderSuffix = (voiceId: string | null) => {
    // Basic heuristic: 'Joana' is female. Default (null) or others assumed Male based on user feedback.
    if (!voiceId) return 'o';
    const lower = voiceId.toLowerCase();
    return (lower.includes('joana') || lower.includes('female') || lower.includes('pt-pt-x-jfn')) ? 'a' : 'o';
};

const recentMessages: string[] = [];
const HISTORY_SIZE = 5;

const MESSAGES = {
    companion: [
        // Time Neutral - Masculine Agreement Enforced
        "Olá {name}, a viagem está a correr bem?",
        "Mantém o foco na estrada {name}, eu vou estar por aqui",
        "Se te sentires cansado não hesites em parar",
        "Estou atent{suffix} à tua condução {name}, continua assim",
        "A segurança em primeiro lugar {name}, sempre",
        "Estás a conduzir muito bem {name}",
        "Gosto de ser tua copiloto digital, vamos com calma",
        "Lembra-te que o importante é chegar, não é chegar rápido",
        "Respira fundo e mantém a calma no trânsito",
        "Estou aqui para te apoiar {name}, segue viagem",
        "Já bebeste água recentemente? A hidratação ajuda o cérebro",
        "Os teus olhos precisam de estar bem abertos, pisca-os com força",
        "Sentes as pálpebras pesadas? Diz-me a verdade",
        "Uma pausa de 5 minutos pode salvar a tua vida {name}",
        "Se precisares de conversar estou aqui, basta chamares",
        "Sabias que conduzir com sono é tão perigoso como conduzir com álcool?",
        "Olha para os espelhos, tudo limpo?",
        "Mantém a distância de segurança {name}",
        "Estou a gostar da tua companhia hoje",
        "Vamos chegar ao destino sãos e salvos",
        "Bom dia {name}! O sol está ótimo para viajar",
        "Que dia bonito para conduzir, não achas?",
        "Aproveita a luz do dia mas usa óculos de sol se precisares",
        "Bom dia! Energia positiva para esta viagem",
        "Boa noite {name}, a estrada está mais escura por isso redobra a atenção",
        "De noite o cansaço bate mais depressa, estou atent{suffix}",
        "Cuidado com as luzes dos outros carros, foca-te na tua faixa",
        "A noite é calma mas exige mais de ti, estou aqui"
    ],
    challenge: [
        { q: "Qual é a capital de França?", a: "A resposta é Paris." },
        { q: "Quanto é 8 vezes 7?", a: "A resposta é 56." },
        { q: "Diz o nome de 3 países com a letra A.", a: "Exemplos: Angola, Alemanha, Argentina." },
        { q: "Qual é a cor do cavalo branco de Napoleão?", a: "A resposta é branco, claro!" },
        { q: "Quanto é 15 mais 18?", a: "A resposta é 33." },
        { q: "Em que ano foi o 25 de Abril?", a: "A resposta é 1974." },
        { q: "Qual é o maior planeta do Sistema Solar?", a: "A resposta é Júpiter." },
        { q: "Quantos segundos tem um minuto?", a: "A resposta é 60 segundos." }
    ]
};

// Helper type for challenge
type ChallengeMessage = { q: string, a: string };

const getRandomMessage = (baseMessages: (string | ChallengeMessage)[]) => {
    // Safety
    if (baseMessages.length === 0) return null;

    let candidate;
    let attempts = 0;
    // Simple dedupe based on JSON stringify for objects
    do {
        candidate = baseMessages[Math.floor(Math.random() * baseMessages.length)];
        attempts++;
    } while (recentMessages.includes(JSON.stringify(candidate)) && attempts < 10);

    const key = JSON.stringify(candidate);
    recentMessages.push(key);
    if (recentMessages.length > HISTORY_SIZE) recentMessages.shift();

    return candidate;
};

let interactionTimer: NodeJS.Timeout | null = null;
let voiceInitialized = false;

// Shared Listener Logic to avoid duplication
const setupVoiceListeners = (set: any, get: any) => {
    Voice.onSpeechStart = () => set({ isListening: true });
    Voice.onSpeechEnd = () => set({ isListening: false });
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
        if (e.value && e.value.length > 0) {
            const text = e.value[0].toLowerCase();
            console.log(`👂 Heard: ${text}`);

            const speakBack = (msg: string) => {
                Speech.speak(msg, {
                    language: 'pt-PT',
                    voice: get().selectedVoice ?? undefined,
                    pitch: 1.0,
                    rate: 1.1
                });
            };

            const userName = get().userName || 'amigo';

            // Interaction Logic
            if (text.includes('sim') || text.includes('claro') || text.includes('ok')) {
                speakBack("Ainda bem!");
            } else if (text.includes('não') || text.includes('nada')) {
                speakBack("Entendido.");
            } else if (text.includes('cansado') || text.includes('sono') || text.includes('dormir')) {
                speakBack("Cuidado! Faz uma pausa imediatamente."); // Critical Safety
            } else if (text.includes('parar') || text.includes('silêncio') || text.includes('stop')) {
                get().stopSession();
            } else if (text.includes('olá') || text.includes('oi') || text.includes('bom dia')) {
                speakBack(`Olá de novo, ${userName}.`);
            } else if (text.includes('obrigado') || text.includes('obrigada')) {
                speakBack("De nada! Estou aqui para ajudar.");
            } else if (text.includes('como estás') || text.includes('tudo bem')) {
                speakBack("Estou bem, obrigada por perguntares. E tu?");
            } else if (text.includes('qual é o teu nome')) {
                speakBack("Eu sou a tua copiloto digital.");
            } else if (text.includes('estou bem') || text.includes('tudo ótimo')) {
                speakBack("Fico feliz em saber! Continua assim.");
            }
        }
    };
};

export const useVoiceCompanionStore = create<VoiceCompanionState>((set, get) => ({
    isEnabled: false,
    mode: 'companion',
    intervalMinutes: 30,
    lastInteractionTime: Date.now(),
    isSpeaking: false,
    isListening: false,
    userName: '',
    selectedVoice: null,

    setUserName: async (name) => {
        const trimmed = name.trim();
        console.log('DEBUG: Saving User Name:', trimmed);
        set({ userName: trimmed });
        await AsyncStorage.setItem('voice_username', trimmed);
    },

    setEnabled: async (enabled) => {
        set({ isEnabled: enabled });
        if (enabled) {
            get().startSession();
        } else {
            get().stopSession();
        }
        await AsyncStorage.setItem('voice_enabled', JSON.stringify(enabled));
    },

    setMode: async (mode) => {
        set({ mode });
        await AsyncStorage.setItem('voice_mode', mode);
    },

    setIntervalMinutes: async (minutes) => {
        set({ intervalMinutes: minutes });
        await AsyncStorage.setItem('voice_interval', JSON.stringify(minutes));
        if (get().isEnabled) {
            get().stopSession();
            get().startSession();
        }
    },

    startSession: () => {
        const { isEnabled, intervalMinutes } = get();
        if (!isEnabled) return;

        console.log('🎤 Voice Companion Session Started');

        // Centralized Listener Setup
        if (!voiceInitialized) {
            setupVoiceListeners(set, get);
            voiceInitialized = true;
        }

        if (interactionTimer) clearInterval(interactionTimer);

        interactionTimer = setInterval(() => {
            get().triggerInteraction();
        }, intervalMinutes * 60 * 1000);
    },

    stopSession: () => {
        if (interactionTimer) {
            clearInterval(interactionTimer);
            interactionTimer = null;
        }
        Speech.stop();
        Voice.destroy().then(Voice.removeAllListeners); // CLEANUP CRITICAL
        set({ isSpeaking: false, isListening: false });
        console.log('🎤 Voice Companion Session Stopped (Cleaned up)');
    },

    startListening: async () => {
        try {
            // Clean up previous sessions to avoid "RecognitionService busy" errors
            await Voice.destroy();
            await Voice.removeAllListeners();



            // Re-bind listeners because destroy might detach them on some versions? 
            // Better strategy: don't destroy, just stop.
            // But user says "doesn't work". Destroy is safer.
            // We need to re-assign listeners if we destroy.
            // RE-INITIALIZE LISTENERS (Shared)
            setupVoiceListeners(set, get);

            await Voice.start('pt-PT');
            console.log('🎤 Listening Started Successfully');
        } catch (e) {
            console.error('STT Start Error (Check Permissions/Google App):', e);
        }
    },

    stopListening: async () => {
        try {
            await Voice.stop();
        } catch (e) {
            console.error(e);
        }
    },

    triggerInteraction: () => {
        const { isSpeaking, mode, userName, selectedVoice } = get();

        if (isSpeaking) return;

        set({ lastInteractionTime: Date.now(), isSpeaking: true });

        // Select Message Category
        const hour = new Date().getHours();
        let category = mode === 'challenge' ? 'challenge' : 'companion';

        // Inject Time-based messages occasionally
        if (mode === 'companion' && Math.random() > 0.7) {
            category = (hour >= 6 && hour < 19) ? 'day' : 'night';
        }

        const list = MESSAGES[category as keyof typeof MESSAGES] || MESSAGES.companion;
        const rawMessage = getRandomMessage(list);


        // Personalization & Gender Adjustment
        const suffix = getGenderSuffix(selectedVoice);
        const validName = (userName && userName.trim().length > 0) ? userName.trim() : (mode === 'companion' ? 'amigo' : 'condutor');

        // CHECK IF CHALLENGE (Object)
        if (rawMessage && typeof rawMessage === 'object') {
            const challenge = rawMessage as ChallengeMessage;
            console.log(`🗣️ Challenge Q: ${challenge.q}`);

            Speech.speak(challenge.q, {
                language: 'pt-PT',
                voice: selectedVoice ?? undefined,
                pitch: 1.0,
                rate: 1.1,
                onDone: () => {
                    set({ isSpeaking: false });
                    // Wait 30s then speak Answer
                    console.log('⏳ Waiting 30s for user to think...');
                    setTimeout(() => {
                        console.log(`🗣️ Challenge A: ${challenge.a}`);
                        Speech.speak(challenge.a, {
                            language: 'pt-PT',
                            voice: get().selectedVoice ?? undefined,
                            rate: 1.1,
                            onDone: () => {
                                // After answer, maybe listen?
                            }
                        });
                    }, 30000); // User asked for 30s, but 15s is better for testing? User said "passado 30s". I will use 30000.
                    // Actually, wait, setTimeout inside this scope might be killed if component unmounts? The store is global.
                }
            });
            // Override 30s as requested
            setTimeout(() => {
                /* Separate Timeout for answer if onDone fails? No, rely on logic above */
            }, 30000);

            // Correct Logic Implementation
            /* Redoing to match specific requirement: Speak Q -> Wait 30s -> Speak A. */
            return;
        }

        if (!rawMessage) return;

        const messageText = rawMessage as string;
        const personalizedMessage = messageText
            .replace(/{name}/g, validName)
            .replace(/{suffix}/g, suffix);

        console.log(`🗣️ Speaking [${category}]: ${personalizedMessage}`);

        Speech.speak(personalizedMessage, {
            language: 'pt-PT',
            voice: selectedVoice ?? undefined,
            pitch: 1.0,
            rate: 1.1, // Faster, less robotic
            onDone: () => {
                set({ isSpeaking: false });
                // If it was a challenge, AUTO-LISTEN
                if (Math.random() > 0.5) {
                    console.log('👂 Auto-listening for specific response...');
                    get().startListening();
                }
            },
            onError: () => set({ isSpeaking: false })
        });
    },

    triggerOnDemand: () => {
        const { isEnabled, userName, selectedVoice } = get();
        if (!isEnabled) return;

        const suffix = getGenderSuffix(selectedVoice); // AI Gender

        const onDemandMessages = [
            `Estou aqui, ${userName}. Estou a ouvir-te.`,
            `Diz, ${userName}. Em que posso ajudar?`,
            `Olá! Estou atent${suffix}. Fala comigo.`,
            "Estou pronta para conversar. O que contas?",
            "Força, sou todos ouvidos."
        ];

        const rawMessage = getRandomMessage(onDemandMessages);
        if (!rawMessage || typeof rawMessage !== 'string') return;

        const personalizedMessage = rawMessage.replace(/{suffix}/g, suffix);

        console.log(`🗣️ On-Demand: ${personalizedMessage}`);

        Speech.speak(personalizedMessage, {
            language: 'pt-PT',
            voice: selectedVoice ?? undefined,
            pitch: 1.0,
            rate: 1.0,
            onDone: () => {
                set({ isSpeaking: false });
                get().startListening();
            }
        });
    },
    forceListen: () => {
        console.log('🎤 Force Listen Triggered by User');
        Speech.stop(); // Stop any current speaking
        set({ isSpeaking: false });
        get().startListening();
    }
}));

// Initialize
const init = async () => {
    try {
        const enabled = await AsyncStorage.getItem('voice_enabled');
        const mode = await AsyncStorage.getItem('voice_mode');
        const interval = await AsyncStorage.getItem('voice_interval');
        const username = await AsyncStorage.getItem('voice_username');

        // Voice Selection Logic (FORCE pt-PT)
        const voices = await Speech.getAvailableVoicesAsync();
        // Look for explicit European Portuguese
        const ptVoice = voices.find(v => v.language.includes('pt-PT') || v.language === 'pt_PT');

        if (ptVoice) {
            console.log(`🗣️ Selected Voice: ${ptVoice.name} (${ptVoice.language})`);
            useVoiceCompanionStore.setState({ selectedVoice: ptVoice.identifier });
        } else {
            console.log('⚠️ No specific pt-PT voice found. Using default locale.');
        }

        if (enabled) useVoiceCompanionStore.setState({ isEnabled: JSON.parse(enabled) });
        if (mode) useVoiceCompanionStore.setState({ mode: mode as VoiceMode });
        if (interval) useVoiceCompanionStore.setState({ intervalMinutes: JSON.parse(interval) });
        if (username) useVoiceCompanionStore.setState({ userName: username });

        if (enabled && JSON.parse(enabled)) {
            useVoiceCompanionStore.getState().startSession();
        }
    } catch (e) {
        console.log('Error loading voice settings:', e);
    }
};

init();
