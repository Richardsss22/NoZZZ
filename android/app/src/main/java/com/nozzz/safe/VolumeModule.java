package com.nozzz.safe;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.hardware.camera2.CameraManager;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class VolumeModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    // Sirene
    private static final int SAMPLE_RATE = 44100;
    private AudioTrack sirenTrack = null;
    private Thread sirenThread = null;
    private volatile boolean isSirenPlaying = false;

    // Strobe
    private boolean isStrobing = false;
    private final Handler strobeHandler = new Handler(Looper.getMainLooper());
    private boolean torchState = false;

    public VolumeModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "VolumeModule";
    }

    // ---------- DND & VOLUME BASE ----------

    private boolean hasDndAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            NotificationManager notificationManager = (NotificationManager) reactContext
                    .getSystemService(Context.NOTIFICATION_SERVICE);
            return notificationManager != null && notificationManager.isNotificationPolicyAccessGranted();
        }
        return true;
    }

    private void setStreamsMaxVolume() {
        AudioManager audioManager = (AudioManager) reactContext.getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null)
            return;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !hasDndAccess()) {
                System.out.println("⚠️ VolumeModule: Sem acesso a DND. O sistema pode limitar o volume.");
            }

            int maxMusic = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            int maxAlarm = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            int maxRing = audioManager.getStreamMaxVolume(AudioManager.STREAM_RING);

            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, maxMusic, AudioManager.FLAG_SHOW_UI);
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxAlarm, 0);
            audioManager.setStreamVolume(AudioManager.STREAM_RING, maxRing, 0);
        } catch (SecurityException e) {
            System.out.println("❌ VolumeModule: SecurityException a mudar volume: " + e.getMessage());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // ---------- MÉTODOS EXPOSTOS A JS (VOLUME/DND) ----------

    @ReactMethod
    public void setMaxVolume(Promise promise) {
        setStreamsMaxVolume();
        if (promise != null)
            promise.resolve("ok");
    }

    @ReactMethod
    public void setMaxAlarmVolume(Promise promise) {
        AudioManager audioManager = (AudioManager) reactContext.getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            int maxAlarm = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxAlarm, 0);
        }
        if (promise != null)
            promise.resolve("ok");
    }

    @ReactMethod
    public void setMaxMusicVolume(Promise promise) {
        AudioManager audioManager = (AudioManager) reactContext.getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            int maxMusic = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, maxMusic, AudioManager.FLAG_SHOW_UI);
        }
        if (promise != null)
            promise.resolve("ok");
    }

    @ReactMethod
    public void checkNotificationPolicyAccess(Promise promise) {
        promise.resolve(hasDndAccess());
    }

    @ReactMethod
    public void requestNotificationPolicyAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                reactContext.startActivity(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    // ---------- SIRENE MATEMÁTICA (ONDA QUADRADA) ----------

    @ReactMethod
    public void playAlarm(Promise promise) {
        if (isSirenPlaying) {
            if (promise != null)
                promise.resolve("already_playing");
            return;
        }

        System.out.println("🚨 VolumeModule: playAlarm chamado (sirene matemática).");

        setStreamsMaxVolume();
        isSirenPlaying = true;

        int minBufferSize = AudioTrack.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT);

        if (minBufferSize <= 0) {
            if (promise != null)
                promise.reject("INIT_ERROR", "Buffer size inválido para AudioTrack");
            isSirenPlaying = false;
            return;
        }

        sirenTrack = new AudioTrack(
                new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                new AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(SAMPLE_RATE)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build(),
                minBufferSize,
                AudioTrack.MODE_STREAM,
                AudioManager.AUDIO_SESSION_ID_GENERATE);

        sirenTrack.play();

        sirenThread = new Thread(() -> {
            double freqLow = 600.0;
            double freqHigh = 1400.0;
            double currentFreq = freqLow;
            int segmentMs = 350;
            int samplesPerSegment = SAMPLE_RATE * segmentMs / 1000;

            short[] buffer = new short[minBufferSize];
            double phase = 0.0;
            int sampleCounter = 0;
            double amplitude = 0.9;

            while (isSirenPlaying) {
                for (int i = 0; i < buffer.length && isSirenPlaying; i++) {
                    double omega = 2.0 * Math.PI * currentFreq / SAMPLE_RATE;
                    phase += omega;
                    if (phase > 2.0 * Math.PI)
                        phase -= 2.0 * Math.PI;

                    double sample = Math.sin(phase);
                    double square = sample >= 0 ? 1.0 : -1.0;

                    buffer[i] = (short) (square * amplitude * 32767);

                    sampleCounter++;
                    if (sampleCounter >= samplesPerSegment) {
                        currentFreq = (currentFreq == freqLow) ? freqHigh : freqLow;
                        sampleCounter = 0;
                    }
                }

                try {
                    sirenTrack.write(buffer, 0, buffer.length);
                } catch (Exception e) {
                    e.printStackTrace();
                    break;
                }
            }

            try {
                if (sirenTrack != null) {
                    sirenTrack.stop();
                    sirenTrack.release();
                }
            } catch (Exception ignored) {
            }

            sirenTrack = null;
            isSirenPlaying = false;
        });

        sirenThread.start();

        if (promise != null)
            promise.resolve("playing");
    }

    @ReactMethod
    public void stopAlarm(Promise promise) {
        System.out.println("🛑 VolumeModule: stopAlarm chamado.");
        isSirenPlaying = false;

        if (sirenThread != null) {
            sirenThread = null;
        }

        try {
            if (sirenTrack != null) {
                sirenTrack.stop();
                sirenTrack.release();
            }
        } catch (Exception ignored) {
        }

        sirenTrack = null;

        if (promise != null)
            promise.resolve("stopped");
    }

    // ---------- STROBE FLASH ----------

    @ReactMethod
    public void strobeFlashlight(Promise promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !isStrobing) {
            final CameraManager cameraManager = (CameraManager) reactContext.getSystemService(Context.CAMERA_SERVICE);
            if (cameraManager == null) {
                if (promise != null)
                    promise.reject("NO_CAMERA", "CameraManager é null");
                return;
            }

            try {
                final String cameraId = cameraManager.getCameraIdList()[0];
                isStrobing = true;

                Runnable strobeRunnable = new Runnable() {
                    @Override
                    public void run() {
                        if (!isStrobing)
                            return;
                        try {
                            torchState = !torchState;
                            cameraManager.setTorchMode(cameraId, torchState);
                            strobeHandler.postDelayed(this, 80);
                        } catch (Exception e) {
                            isStrobing = false;
                            e.printStackTrace();
                        }
                    }
                };

                strobeHandler.post(strobeRunnable);

                if (promise != null)
                    promise.resolve("strobe_started");
            } catch (Exception e) {
                e.printStackTrace();
                if (promise != null)
                    promise.reject("STROBE_ERROR", e.getMessage());
            }
        } else {
            if (promise != null)
                promise.resolve("not_supported_or_already_strobing");
        }
    }

    @ReactMethod
    public void stopStrobe(Promise promise) {
        isStrobing = false;
        strobeHandler.removeCallbacksAndMessages(null);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            CameraManager cameraManager = (CameraManager) reactContext.getSystemService(Context.CAMERA_SERVICE);
            try {
                if (cameraManager != null) {
                    String cameraId = cameraManager.getCameraIdList()[0];
                    cameraManager.setTorchMode(cameraId, false);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        if (promise != null)
            promise.resolve("strobe_stopped");
    }

    // ---------- PHONE CALL ----------

    @ReactMethod
    public void callPhone(String number, Promise promise) {
        if (number == null || number.isEmpty()) {
            if (promise != null)
                promise.reject("INVALID_NUMBER", "Número vazio");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_CALL);
            intent.setData(android.net.Uri.parse("tel:" + number));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            if (promise != null)
                promise.resolve("calling");
        } catch (SecurityException e) {
            System.out.println("❌ VolumeModule: Permissão de chamada em falta.");
            if (promise != null)
                promise.reject("PERMISSION_DENIED", e.getMessage());
        } catch (Exception e) {
            e.printStackTrace();
            if (promise != null)
                promise.reject("CALL_ERROR", e.getMessage());
        }
    }
}
