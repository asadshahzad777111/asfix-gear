import { isMongoEnabled, connectMongo, getStorageBackend } from '../db/client.js';
import * as jsonStorage from './json-storage.js';
import * as mongoStorage from './mongo-storage.js';

let initPromise = null;

export async function initStorage() {
  if (!isMongoEnabled()) return 'json';
  if (!initPromise) {
    initPromise = connectMongo().then(() => 'mongodb');
  }
  return initPromise;
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
