import * as FileSystem from 'expo-file-system';

const FILE = FileSystem.documentDirectory + 'oculus_store.json';

type StoreMap = Record<string, string>;

async function readAll(): Promise<StoreMap> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(FILE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeAll(data: StoreMap) {
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(data));
}

export const ExpoFsStorage = {
  getItem: async (name: string) => {
    const all = await readAll();
    return all[name] ?? null;
  },
  setItem: async (name: string, value: string) => {
    const all = await readAll();
    all[name] = value;
    await writeAll(all);
  },
  removeItem: async (name: string) => {
    const all = await readAll();
    delete all[name];
    await writeAll(all);
  },
};