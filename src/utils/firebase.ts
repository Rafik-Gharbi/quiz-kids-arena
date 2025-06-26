
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, push, serverTimestamp } from 'firebase/database';

// Note: In a real application, you would need actual Firebase config
// For demo purposes, we'll use localStorage as a fallback
const firebaseConfig = {
  // Your Firebase config would go here
  // For now, we'll simulate with localStorage
};

let app: any = null;
let database: any = null;

export const initializeFirebase = () => {
  try {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
  } catch (error) {
    console.log('Firebase not configured, using localStorage fallback');
    // We'll use localStorage as a fallback for demo purposes
  }
};

// Fallback storage using localStorage
class LocalStorage {
  private listeners: Record<string, Function[]> = {};

  set(path: string, data: any) {
    localStorage.setItem(path.replace(/\//g, '_'), JSON.stringify(data));
    this.notifyListeners(path, data);
  }

  get(path: string) {
    const data = localStorage.getItem(path.replace(/\//g, '_'));
    return data ? JSON.parse(data) : null;
  }

  on(path: string, callback: Function) {
    if (!this.listeners[path]) {
      this.listeners[path] = [];
    }
    this.listeners[path].push(callback);
  }

  off(path: string, callback: Function) {
    if (this.listeners[path]) {
      this.listeners[path] = this.listeners[path].filter(cb => cb !== callback);
    }
  }

  private notifyListeners(path: string, data: any) {
    if (this.listeners[path]) {
      this.listeners[path].forEach(callback => callback(data));
    }
  }
}

const localStorage_fallback = new LocalStorage();

export const writeData = (path: string, data: any) => {
  if (database) {
    return set(ref(database, path), data);
  } else {
    localStorage_fallback.set(path, data);
    return Promise.resolve();
  }
};

export const readData = async (path: string) => {
  if (database) {
    const snapshot = await get(ref(database, path));
    return snapshot.val();
  } else {
    return localStorage_fallback.get(path);
  }
};

export const listenToData = (path: string, callback: (data: any) => void) => {
  if (database) {
    const dataRef = ref(database, path);
    onValue(dataRef, (snapshot) => {
      callback(snapshot.val());
    });
  } else {
    localStorage_fallback.on(path, callback);
  }
};

export const generateSessionId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};
