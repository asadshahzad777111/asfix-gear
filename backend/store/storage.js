import { isMongoEnabled, connectMongo, getStorageBackend } from '../db/client.js';
import * as jsonStorage from './json-storage.js';
import * as mongoStorage from './mongo-storage.js';

let initPromise = null;
let storageReady = null;

export async function initStorage() {
  if (!isMongoEnabled()) {
    storageReady = 'json';
    return 'json';
  }
  if (storageReady === 'mongodb') return 'mongodb';
  if (!initPromise) {
    initPromise = connectMongo()
      .then(() => mongoStorage.warmCache())
      .then(() => {
        storageReady = 'mongodb';
        return 'mongodb';
      })
      .catch((err) => {
        initPromise = null;
        throw err;
      });
  }
  return initPromise;
}

/** null = still connecting, 'json' | 'mongodb' = ready */
export function isStorageReady() {
  if (!isMongoEnabled()) return storageReady === 'json' ? 'json' : true;
  return storageReady;
}

function adapter() {
  return isMongoEnabled() ? mongoStorage : jsonStorage;
}

export function readData() {
  return adapter().readData();
}

export function withData(mutator) {
  return adapter().withData(mutator);
}

export { getStorageBackend, isMongoEnabled };

export function getDataFilePath() {
  return jsonStorage.getDataFilePath();
}

export { writeFullSnapshot, readFullSnapshot } from './mongo-storage.js';
