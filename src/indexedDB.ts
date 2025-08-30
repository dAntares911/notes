import type { Note } from "./types";

const DB_NAME = "StickyNotesDB";
const DB_VERSION = 1;
const STORE_NAME = "notes";

// Open IndexedDB connection
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open database"));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });

        // Create indexes for better querying
        store.createIndex("zIndex", "zIndex", { unique: false });
        store.createIndex("color", "color", { unique: false });
        store.createIndex("priority", "priority", { unique: false });
      }
    };
  });
};

// Save multiple notes
export const saveNotes = async (notes: Note[]): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    // Clear existing notes first
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(new Error("Failed to clear notes"));
    });

    // Save all notes
    for (const note of notes) {
      await new Promise<void>((resolve, reject) => {
        const request = store.put(note);
        request.onsuccess = () => resolve();
        request.onerror = () =>
          reject(new Error(`Failed to save note ${note.id}`));
      });
    }

    db.close();
  } catch (error) {
    console.error("Error saving notes:", error);
    throw error;
  }
};

// Load all notes
export const loadNotes = async (): Promise<Note[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);

    const notes = await new Promise<Note[]>((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error("Failed to load notes"));
      };
    });

    db.close();
    return notes;
  } catch (error) {
    console.error("Error loading notes:", error);
    return []; // Return empty array on error
  }
};

// Delete a single note
export const deleteNote = async (noteId: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(noteId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to delete note"));
    });

    db.close();
  } catch (error) {
    console.error("Error deleting note:", error);
    throw error;
  }
};

// Check if IndexedDB is supported
export const isIndexedDBSupported = (): boolean => {
  return typeof indexedDB !== "undefined";
};
