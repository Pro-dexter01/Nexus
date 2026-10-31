const DB_NAME = "nexus-v-lab";
const DB_VERSION = 1;
const STORE = "projects";

export type NexusProject = {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  file: Blob;
  createdAt: number;
  updatedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Nexus local storage could not be opened."));
  });
}

export async function saveNexusProject(project: NexusProject) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Project could not be saved locally."));
  });
  db.close();
}

export async function listNexusProjects(): Promise<Omit<NexusProject, "file">[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => {
      db.close();
      resolve(request.result.map(({ file: _file, ...project }: NexusProject) => project).sort((a, b) => b.updatedAt - a.updatedAt));
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function getNexusProject(id: string): Promise<NexusProject | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    request.onsuccess = () => { db.close(); resolve(request.result ?? null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function deleteNexusProject(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function requestNexusPersistentStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try { return await navigator.storage.persist(); } catch { return false; }
}
