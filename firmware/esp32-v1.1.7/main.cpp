#include <Arduino.h>
#include <math.h> // ADICIONADO: necessário para atan2
// ================== CONFIG ==================
#define ENABLE_SPP 0
#if ENABLE_SPP
#include "BluetoothSerial.h"
BluetoothSerial SerialBT;
#else
#include "esp_bt.h"
#endif
#include <NimBLEDevice.h>
static const char *SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
static const char *RX_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
static const char *TX_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";
static NimBLECharacteristic *txChar = nullptr;
static NimBLEAdvertising *adv = nullptr;
static volatile bool bleConnected = false;
static String bleCmdBuf;
// !!! NOVO: Variável de agendamento (o segredo para não bloquear) !!!
String commandToRun = "";
// ===== forward declaration =====
void imprimir(const String &texto);
void imprimirImportante(const String &texto);
void enviarBluetooth(const String &texto);
void handleCommand(const String &cmdRaw);
// =================== TEU CÓDIGO ORIGINAL (IGUAL) ===================
const int sensorPin = 36;
#define MAX_EVENTO 50
// ----------------------------cenas a ser mudadas---------------------
const float LIMIAR_DERIVADA = 1.40;
const int DURACAO_MIN = 5;
const int DURACAO_MAX = 70;
//---------------------------------------------------------------------x
const float DERIVADA_LENTA_MAX = 1.0;
const int DURACAO_LENTA_MIN = 145;
const int DURACAO_LENTA_MAX = 350;
int limiarInferior = 471;
int AMPLITUDE_MIN_LENTA = 60;
int AMPLITUDE_MIN = 90;
int contagemBlinksNormais = 0;
int contagemBlinksLentos = 0;
unsigned long somaDuracoesNormais = 0;
unsigned long somaAmplitudesNormais = 0;
unsigned long somaDuracoesLentas = 0;
unsigned long somaAmplitudesLentas = 0;
bool emEvento = false;
int valoresEvento[MAX_EVENTO];
unsigned long temposEvento[MAX_EVENTO];
int eventoIndex = 0;
// =================== BASELINE + ALERTA POR MINUTO ===================
static float baselineBpm = 0.0f;
// contadores do minuto corrente durante S
static unsigned long minuteStartMs = 0;
static uint16_t currentMinuteNormal = 0;
static uint16_t currentMinuteSlow = 0;
// critérios de aviso
static const float BPM_INCREASE_FACTOR = 1.30f; // +30% vs baseline
static const uint16_t SLOW_BPM_ALERT = 2;       // bpm lentas >= 2
static const unsigned long ONE_MIN_MS = 60000UL;
// =================== ABORT (X) ===================
static volatile bool abortRequested = false;

// =================== ADICIONADO: ACELERÓMETRO ADXL335 ===================
#define PIN_X 32
#define PIN_Y 33
#define PIN_Z 39
const float offset_x = 704.3;
const float offset_y = 700.8;
const float offset_z = 740.0;
const float scale_x = 207.7;
const float scale_y = 203.2;
const float scale_z = 206.6;
float filtered_roll = 0;
float filtered_pitch = 0;
const float alpha = 0.15;
float readAvg(int pin) {
  long soma = 0;
  for (int i = 0; i < 5; i++) { // 5 amostras rápidas para não bloquear EOG
    soma += analogRead(pin);
    delayMicroseconds(100);
  }
  return soma / 5.0;
}
void updateAccelerometer() {
  float raw_x = readAvg(PIN_X);
  float raw_y = readAvg(PIN_Y);
  float raw_z = readAvg(PIN_Z);
  float gx = (raw_x - offset_x) / scale_x;
  float gy = (raw_y - offset_y) / scale_y;
  float gz = -(raw_z - offset_z) / scale_z;
  gx = constrain(gx, -1.0, 1.0);
  gy = constrain(gy, -1.0, 1.0);
  gz = constrain(gz, -1.0, 1.0);
  float current_pitch = atan2(gx, sqrt(gz * gz + gy * gy)) * 180.0 / PI;
  float current_roll = atan2(gz, sqrt(gx * gx + gy * gy)) * 180.0 / PI;
  filtered_roll = alpha * current_roll + (1.0 - alpha) * filtered_roll;
  filtered_pitch = alpha * current_pitch + (1.0 - alpha) * filtered_pitch;
  if (abs(filtered_roll) < 2)
    filtered_roll = 0;
  if (abs(filtered_pitch) < 2)
    filtered_pitch = 0;
}
// =================== FIM ADICIONADO ===================

// =================== UTILITÁRIOS ===================
void bleSendLine(const String &s) {
  if (!txChar)
    return;
  String line = s + "\n";
  const uint16_t mtu = 20; // safe BLE payload size
  size_t offset = 0;
  while (offset < line.length()) {
    size_t chunk = line.length() - offset;
    if (chunk > mtu)
      chunk = mtu;
    txChar->setValue((uint8_t *)(line.c_str() + offset), chunk);
    txChar->notify();
    offset += chunk;
    if (offset < line.length())
      delay(8); // espera entre fragmentos
  }
}
// USB apenas
void imprimir(const String &texto) { Serial.println(texto); }
// Bluetooth apenas
void enviarBluetooth(const String &texto) {
#if ENABLE_SPP
  SerialBT.println(texto);
#endif
  if (bleConnected)
    bleSendLine(texto);
}
// USB + Bluetooth (só para mensagens "importantes": calibração, etc.)
void imprimirImportante(const String &texto) {
  imprimir(texto);
  enviarBluetooth(texto);
}
bool lerLinhaStream(Stream &st, String &out) {
  if (!st.available())
    return false;
  out = st.readStringUntil('\n');
  out.trim();
  return out.length() > 0;
}
bool lerLinhaComando(String &out) {
  if (lerLinhaStream(Serial, out))
    return true;
#if ENABLE_SPP
  if (lerLinhaStream(SerialBT, out))
    return true;
#endif
  return false;
}
void aplicarThresholdManual(const String &cmd) {
  int v = cmd.substring(3).toInt();
  if (v > 0) {
    AMPLITUDE_MIN = v;
    imprimir(">> Threshold manual aplicado: AMPLITUDE_MIN = " +
             String(AMPLITUDE_MIN));
  } else {
    imprimir(">> TH inválido. Use TH=numero (ex: TH=90)");
  }
}
// apanha X imediato sem engolir outros comandos
static inline void pollAbortImmediate() {
  while (Serial.available()) {
    char c = (char)Serial.peek();
    if (c == 'x' || c == 'X') {
      Serial.read();
      abortRequested = true;
    } else {
      break;
    }
  }
#if ENABLE_SPP
  while (SerialBT.available()) {
    char c = (char)SerialBT.peek();
    if (c == 'x' || c == 'X') {
      SerialBT.read();
      abortRequested = true;
    } else {
      break;
    }
  }
#endif
}
static inline bool shouldAbortNow() {
  pollAbortImmediate();
  return abortRequested;
}
// =================== MINUTO: fechar e devolver contagens ===================
bool tickMinute(unsigned long now, uint16_t &endedNormal, uint16_t &endedSlow) {
  bool closedAny = false;
  while (now - minuteStartMs >= ONE_MIN_MS) {
    endedNormal = currentMinuteNormal;
    endedSlow = currentMinuteSlow;
    currentMinuteNormal = 0;
    currentMinuteSlow = 0;
    minuteStartMs += ONE_MIN_MS;
    closedAny = true;
  }
  return closedAny;
}
// === NOVO: envia o array por Bluetooth no formato pedido ===
static inline void enviarArrayMinutoBluetooth(uint32_t minutoN,
                                              uint16_t normais, uint16_t lentas,
                                              bool sonoDetectado) {
  String m = "M" + String(minutoN);
  String flag = sonoDetectado ? "S-" : "NS-";
  // array em string (tipo JSON)
  String payload = "[\"" + m + "\"," + String(normais) + "," + String(lentas) +
                   ",\"" + flag + "\"]";
  enviarBluetooth(payload);
}
// ADICIONADO: envia array RT com EOG + acelerómetro
static inline void enviarRT(unsigned long ts, int eog, float roll,
                            float pitch) {
  String payload = "[\"RT\"," + String(ts) + "," + String(eog) + "," +
                   String(roll, 1) + "," + String(pitch, 1) + "]";
  enviarBluetooth(payload);
}
// =================== CALIBRAR ===================
void calibrar() {
  abortRequested = false;
  imprimir("=== Calibração 1/2 ===");
  imprimir("10s olhos abertos, sem mexer e sem piscar. (X para sair)");
  long soma = 0;
  long soma2 = 0;
  int n = 0;
  for (int s = 1; s <= 10; s++) {
    if (shouldAbortNow()) {
      imprimir(">> Saí da calibração (X).");
      return;
    }
    imprimir("Baseline: " + String(s) + "/10 s");
    for (int i = 0; i < 50; i++) {
      if (shouldAbortNow()) {
        imprimir(">> Saí da calibração (X).");
        return;
      }
      int v = analogRead(sensorPin);
      soma += v;
      soma2 += (long)v * (long)v;
      n++;
      delay(20);
    }
  }
  float baseline = soma / (float)n;
  float variancia = (soma2 / (float)n) - (baseline * baseline);
  float sigma = variancia > 0 ? sqrt(variancia) : 0;
  int offset = (int)(5.0 * sigma);
  if (offset < 20)
    offset = 20;
  if (offset > 150)
    offset = 150;
  limiarInferior = (int)baseline - offset;
  imprimir("Baseline ADC: " + String(baseline, 1));
  imprimir("Sigma (ruído): " + String(sigma, 2));
  imprimir("Offset escolhido: " + String(offset));
  imprimir(">> limiarInferior calibrado: " + String(limiarInferior));
  delay(500);
  imprimir("=== Calibração 2/2 ===");
  imprimir("10s a piscar normalmente (sem forçar). (X para sair)");
  int ampMax = 0;
  bool emEv = false;
  int inicioV = 0;
  int picoV = 4095;
  unsigned long t0 = millis();
  unsigned long tLast = millis();
  while (millis() - t0 < 10000) {
    if (shouldAbortNow()) {
      imprimir(">> Saí da calibração (X).");
      return;
    }
    int v = analogRead(sensorPin);
    if (!emEv && v < limiarInferior) {
      emEv = true;
      inicioV = v;
      picoV = v;
    }
    if (emEv) {
      if (v < picoV)
        picoV = v;
      if (v >= limiarInferior) {
        emEv = false;
        int amp = abs(picoV - inicioV);
        if (amp > ampMax)
          ampMax = amp;
      }
    }
    if (millis() - tLast >= 1000) {
      int sec = (millis() - t0) / 1000;
      imprimir("Piscar: " + String(sec) + "/10 s");
      tLast = millis();
    }
    delay(10);
  }
  AMPLITUDE_MIN = (int)((0.60) * ampMax);
  if (AMPLITUDE_MIN < 10)
    AMPLITUDE_MIN = 10;
  AMPLITUDE_MIN_LENTA = (int)((1.0 / 2.0) * ampMax);
  if (AMPLITUDE_MIN_LENTA < 10)
    AMPLITUDE_MIN_LENTA = 10;
  imprimir("Amplitude máxima observada: " + String(ampMax));
  imprimir(">> AMPLITUDE_MIN (1/2 do max): " + String(AMPLITUDE_MIN));
  // Só o resultado final vai por Bluetooth (texto) como antes
  if (ampMax < 15 || sigma > 110) {
    imprimirImportante("Calibração mal efetuada");
  } else {
    imprimirImportante("Calibração concluída");
  }
}
// =================== comando P (baseline BPM normal em 30s)
// ===================
static const unsigned long BASELINE_P_MS = 30000UL;
void medirBaselinePiscadelas_30s() {
  abortRequested = false;
  imprimir("=== Baseline Piscadelas (P) ===");
  imprimir("30s a piscar normalmente. A medir BPM baseline... (X para sair)");
  int blinksNormaisLocal = 0;
  unsigned long t0 = millis();
  unsigned long tLast = millis();
  emEvento = false;
  eventoIndex = 0;
  while (millis() - t0 < BASELINE_P_MS) {
    if (shouldAbortNow()) {
      imprimir(">> Saí do baseline P (X).");
      return;
    }
    int leitura = analogRead(sensorPin);
    unsigned long agora = millis();
    if (agora - tLast >= 1000) {
      int sec = (agora - t0) / 1000;
      imprimir("Tempo P: " + String(sec) + "/30 s");
      tLast = agora;
    }
    if (!emEvento && leitura < limiarInferior) {
      emEvento = true;
      eventoIndex = 0;
    }
    if (emEvento) {
      if (eventoIndex < MAX_EVENTO) {
        valoresEvento[eventoIndex] = leitura;
        temposEvento[eventoIndex] = agora;
        eventoIndex++;
      }
      if (leitura >= limiarInferior || eventoIndex >= MAX_EVENTO) {
        emEvento = false;
        int valorInicio = valoresEvento[0];
        unsigned long tempoInicioEvento = temposEvento[0];
        int pico = valorInicio;
        unsigned long tempoPico = tempoInicioEvento;
        for (int i = 1; i < eventoIndex; i++) {
          if (valoresEvento[i] < pico) {
            pico = valoresEvento[i];
            tempoPico = temposEvento[i];
          }
        }
        float deltaValor = abs(pico - valorInicio);
        float deltaTempo = (float)(tempoPico - tempoInicioEvento);
        float derivada = deltaTempo > 0 ? deltaValor / deltaTempo : 0;
        if (derivada >= LIMIAR_DERIVADA && deltaTempo >= DURACAO_MIN &&
            deltaTempo <= DURACAO_MAX) {
          blinksNormaisLocal++;
          imprimir("✓ Piscadela NORMAL detetada (P)");
        }
      }
    }
    delay(10);
  }
  baselineBpm = (float)blinksNormaisLocal * (60000.0f / (float)BASELINE_P_MS);
  imprimir("=== Baseline P concluído ===");
  imprimir("Piscadelas normais em 30s: " + String(blinksNormaisLocal));
  imprimir("BASELINE_BPM: " + String(baselineBpm, 2));
}
// -------------------- S: INFINITO, USB com texto, Bluetooth com array
// --------------------
void correrSessao() {
  abortRequested = false;
  contagemBlinksNormais = 0;
  contagemBlinksLentos = 0;
  somaDuracoesNormais = 0;
  somaAmplitudesNormais = 0;
  somaDuracoesLentas = 0;
  somaAmplitudesLentas = 0;
  imprimir("=== Sessão iniciada ===");
  imprimir("Fase: pisque normalmente (INFINITO). (X para sair)");
  imprimir("BLE envia RT a cada 100ms + array de minuto "
           "[M#,normais,lentas,S-/NS-].");
  minuteStartMs = millis();
  currentMinuteNormal = 0;
  currentMinuteSlow = 0;
  unsigned long tempoInicio = millis();
  unsigned long tempoAnteriorSeg = millis();
  uint32_t minutoN = 0;
  unsigned long ultimoAcc =
      millis(); // ADICIONADO: controla update do acelerómetro
  unsigned long ultimoRT = millis(); // ADICIONADO: controla envio do array RT
  while (true) {
    if (shouldAbortNow()) {
      imprimir(">> Saí da sessão S (X).");
      return;
    }
    int leitura = analogRead(sensorPin);
    unsigned long agora = millis();

    // ADICIONADO: atualiza acelerómetro a cada 100ms (não bloqueia EOG)
    if (agora - ultimoAcc >= 100) {
      ultimoAcc = agora;
      updateAccelerometer();
    }
    // ADICIONADO: envia array RT a cada 100ms
    if (agora - ultimoRT >= 100) {
      ultimoRT = agora;
      enviarRT(agora, leitura, filtered_roll, filtered_pitch);
    }

    // fecha minuto(s)
    uint16_t endedNormal = 0, endedSlow = 0;
    if (tickMinute(agora, endedNormal, endedSlow)) {
      minutoN++;
      // condição de sono/cansaço (mesma lógica do teu alerta)
      bool hasBaseline = baselineBpm > 0.01f;
      bool bpmUp30 = hasBaseline &&
                     ((float)endedNormal >= baselineBpm * BPM_INCREASE_FACTOR);
      bool slowOk = (endedSlow >= SLOW_BPM_ALERT);
      bool sonoDetectado = (bpmUp30 && slowOk);
      // USB mantém texto como estava
      if (sonoDetectado) {
        imprimir("CANSAÇO!!!!!!!!");
        imprimir(String("RELATORIO_MINUTO ") + "normal_bpm=" +
                 String(endedNormal) + " slow_bpm=" + String(endedSlow) +
                 " baseline_bpm=" + String(baselineBpm, 2));
      }
      imprimir("=== Resultados (minuto " + String(minutoN) + ") ===");
      imprimir("Piscadelas normais: " + String(endedNormal));
      imprimir("Piscadelas lentas (sonolência): " + String(endedSlow));
      // Bluetooth: SÓ o array pedido
      enviarArrayMinutoBluetooth(minutoN, endedNormal, endedSlow,
                                 sonoDetectado);
    }
    if (agora - tempoAnteriorSeg >= 1000) {
      int segundos = (agora - tempoInicio) / 1000;
      imprimir("Tempo: " + String(segundos) + "s");
      tempoAnteriorSeg = agora;
    }
    if (!emEvento && leitura < limiarInferior) {
      emEvento = true;
      eventoIndex = 0;
    }
    if (emEvento) {
      if (eventoIndex < MAX_EVENTO) {
        valoresEvento[eventoIndex] = leitura;
        temposEvento[eventoIndex] = agora;
        eventoIndex++;
      }
      if (leitura >= limiarInferior || eventoIndex >= MAX_EVENTO) {
        emEvento = false;
        int valorInicio = valoresEvento[0];
        unsigned long tempoInicioEvento = temposEvento[0];
        int pico = valorInicio;
        unsigned long tempoPico = tempoInicioEvento;
        for (int i = 1; i < eventoIndex; i++) {
          if (valoresEvento[i] < pico) {
            pico = valoresEvento[i];
            tempoPico = temposEvento[i];
          }
        }
        float deltaValor = abs(pico - valorInicio);
        float deltaTempo = (float)(tempoPico - tempoInicioEvento);
        float derivada = deltaTempo > 0 ? deltaValor / deltaTempo : 0;
        if (derivada >= LIMIAR_DERIVADA && deltaTempo >= DURACAO_MIN &&
            deltaTempo <= DURACAO_MAX && deltaValor >= AMPLITUDE_MIN) {
          contagemBlinksNormais++;
          somaDuracoesNormais += (unsigned long)deltaTempo;
          somaAmplitudesNormais += (unsigned long)deltaValor;
          currentMinuteNormal++;
          imprimir("✓ Piscadela NORMAL detetada");
        } else if (derivada < DERIVADA_LENTA_MAX &&
                   deltaTempo >= DURACAO_LENTA_MIN &&
                   deltaTempo <= DURACAO_LENTA_MAX &&
                   deltaValor >= AMPLITUDE_MIN_LENTA) {
          contagemBlinksLentos++;
          somaDuracoesLentas += (unsigned long)deltaTempo;
          somaAmplitudesLentas += (unsigned long)deltaValor;
          currentMinuteSlow++;
          imprimir("⚠ Piscadela LENTA (SONOLÊNCIA) detetada");
        }
      }
    }
    delay(10);
  }
}
// =================== COMMAND HANDLER (CORRIGIDO) ===================
void handleCommand(const String &cmdRaw) {
  String cmd = cmdRaw;
  cmd.trim();
  if (cmd.length() == 0)
    return;
  //!!! X : PRIORIDADE MÁXIMA E IMEDIATA !!!
  if (cmd == "X" || cmd == "x") {
    abortRequested = true;
    imprimir(">> X recebido: a sair do ciclo atual e voltar ao idle.");
    return;
  }
  //!!! C, P, S : AGENDADOS PARA O LOOP (NÃO BLOQUEIAM O BLUETOOTH) !!!
  if (cmd == "C" || cmd == "c") {
    commandToRun = "C";
  } else if (cmd == "P" || cmd == "p") {
    commandToRun = "P";
  } else if (cmd == "S" || cmd == "s") {
    commandToRun = "S";
  } else if (cmd.startsWith("TH=") || cmd.startsWith("th=")) {
    aplicarThresholdManual(cmd);
  } else {
    imprimir("Comando desconhecido. Use C, P, S, X ou TH=valor.");
  }
}
// =================== BLE CALLBACKS ===================
class ServerCB : public NimBLEServerCallbacks {
public:
  void onConnect(NimBLEServer *pServer) {
    (void)pServer;
    bleConnected = true;
    imprimir("[BLE] Conectado.");
  }
  void onDisconnect(NimBLEServer *pServer) {
    (void)pServer;
    bleConnected = false;
    imprimir("[BLE] Desconectado. A anunciar de novo...");
    if (adv)
      adv->start();
  }
  void onConnect(NimBLEServer *pServer, ble_gap_conn_desc *desc) {
    (void)pServer;
    (void)desc;
    bleConnected = true;
    imprimir("[BLE] Conectado.");
  }
  void onDisconnect(NimBLEServer *pServer, ble_gap_conn_desc *desc) {
    (void)pServer;
    (void)desc;
    bleConnected = false;
    imprimir("[BLE] Desconectado. A anunciar de novo...");
    if (adv)
      adv->start();
  }
  void onConnect(NimBLEServer *pServer, NimBLEConnInfo &connInfo) {
    (void)pServer;
    (void)connInfo;
    bleConnected = true;
    imprimir("[BLE] Conectado.");
  }
  void onDisconnect(NimBLEServer *pServer, NimBLEConnInfo &connInfo,
                    int reason) {
    (void)pServer;
    (void)connInfo;
    (void)reason;
    bleConnected = false;
    imprimir("[BLE] Desconectado. A anunciar de novo...");
    if (adv)
      adv->start();
  }
};
class RxCB : public NimBLECharacteristicCallbacks {
public:
  void onWrite(NimBLECharacteristic *c) { handleWrite(c); }
  void onWrite(NimBLECharacteristic *c, NimBLEConnInfo & /*connInfo*/) {
    handleWrite(c);
  }

private:
  void handleWrite(NimBLECharacteristic *c) {
    std::string v = c->getValue();
    if (v.empty())
      return;
    // Apanha X sem bloquear, mas deixa o resto para o parser
    for (char ch : v) {
      if (ch == 'x' || ch == 'X') {
        abortRequested = true;
      }
    }
    bool hadNewline = false;
    for (char ch : v) {
      if (ch == '\n') {
        hadNewline = true;
        handleCommand(bleCmdBuf);
        bleCmdBuf = "";
      } else if (ch != '\r') {
        bleCmdBuf += ch;
      }
    }
    if (!hadNewline) {
      handleCommand(bleCmdBuf);
      bleCmdBuf = "";
    }
  }
};
void setupBLE() {
#if !ENABLE_SPP
  esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT);
#endif
  NimBLEDevice::init("EOG-Calibracao");
  NimBLEDevice::setMTU(128);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  NimBLEServer *server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCB());
  NimBLEService *svc = server->createService(SERVICE_UUID);
  txChar = svc->createCharacteristic(TX_UUID, NIMBLE_PROPERTY::NOTIFY);
  NimBLECharacteristic *rxChar = svc->createCharacteristic(
      RX_UUID, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  rxChar->setCallbacks(new RxCB());
  svc->start();
  adv = NimBLEDevice::getAdvertising();
  adv->reset();
  NimBLEAdvertisementData advData;
  advData.setFlags(0x06);
  advData.setCompleteServices(NimBLEUUID(SERVICE_UUID));
  adv->setAdvertisementData(advData);
  NimBLEAdvertisementData scanData;
  scanData.setName("EOG-Calibracao");
  adv->setScanResponseData(scanData);
  adv->start();
  imprimir("[BLE] A anunciar (Nome + UART UUID)...");
}
void setup() {
  Serial.begin(115200);
  delay(200);
#if ENABLE_SPP
  SerialBT.begin("EOG-Calibracao");
#endif
  // ADICIONADO: ADC por pino (NÃO global — EOG e acelerómetro precisam de
  // atenuações diferentes)
  analogReadResolution(12);
  analogSetPinAttenuation(sensorPin, ADC_11db); // EOG pin 36: lê até 3.3V
  analogSetPinAttenuation(PIN_X, ADC_0db);      // Acelerómetro: lê até ~1.1V
  analogSetPinAttenuation(PIN_Y, ADC_0db);
  analogSetPinAttenuation(PIN_Z, ADC_0db);
  setupBLE();
  imprimir("Comandos (Serial / SPP / BLE):");
  imprimir("  C        -> calibrar");
  imprimir("  P        -> baseline piscadelas 30s (BPM)");
  imprimir("  S        -> sessão INFINITA (Bluetooth envia array por minuto)");
  imprimir("  X        -> sair do ciclo atual e voltar ao idle");
  imprimir("  TH=valor -> threshold manual");
}
// =================== MAIN LOOP ===================
void loop() {
  pollAbortImmediate();
  if (abortRequested) {
    abortRequested = false;
    imprimir(">> Idle: X recebido (não estava nenhum ciclo a correr).");
  }
  //!!! MÁGICA: Se houver um comando "S", "C" ou "P", corre AQUI e não no
  //!Bluetooth
  if (commandToRun != "") {
    String op = commandToRun;
    commandToRun = ""; // limpa
    if (op == "C")
      calibrar();
    else if (op == "P")
      medirBaselinePiscadelas_30s();
    else if (op == "S")
      correrSessao();
  }
  String cmd;
  if (lerLinhaComando(cmd))
    handleCommand(cmd);
  delay(20);
}
