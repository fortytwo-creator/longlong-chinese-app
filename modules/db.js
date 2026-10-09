export class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve) => {
      const request = indexedDB.open('LonglongDB', 1);
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(true);
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'id' });
        }
      };
    });
  }

  async getProfile() {
    return new Promise((resolve) => {
      const tx = this.db.transaction('profiles', 'readonly');
      const store = tx.objectStore('profiles');
      const request = store.get(1);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async saveProfile(profile) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('profiles', 'readwrite');
      const store = tx.objectStore('profiles');
      const request = store.put(profile);
      request.onsuccess = () => resolve(true);
    });
  }

  async getProgress(key) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('progress', 'readonly');
      const store = tx.objectStore('progress');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || {});
    });
  }

  async saveProgress(key, data) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('progress', 'readwrite');
      const store = tx.objectStore('progress');
      const request = store.put({ id: key, ...data });
      request.onsuccess = () => resolve(true);
    });
  }
}

export const db = new Database();
