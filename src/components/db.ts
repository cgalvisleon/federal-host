import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "myAppDB";
const DB_VERSION = 1;

interface StoreDefinition {
  keyPath: string;
  autoIncrement?: boolean;
  indexes?: { name: string; keyPath: string; unique?: boolean }[];
}

type QueryFilter =
  | { type: "exact"; value: any }
  | { type: "prefix"; value: string }
  | { type: "gte" | "lte" | "gt" | "lt"; value: any }
  | { type: "contains"; value: string; field?: string };

let dbPromise: Promise<IDBPDatabase> | null = null;
let storesToEnsure: Record<string, StoreDefinition> = {};

/**
 * Registra stores que se crearán si no existen.
 */
export function ensureStore(
  storeName: string,
  definition: StoreDefinition
): void {
  storesToEnsure[storeName] = definition;
}

/**
 * Inicializa la base de datos creando los stores que falten.
 */
async function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const [name, def] of Object.entries(storesToEnsure)) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, {
              keyPath: def.keyPath,
              autoIncrement: def.autoIncrement ?? false,
            });
            def.indexes?.forEach((idx) =>
              store.createIndex(idx.name, idx.keyPath, { unique: idx.unique })
            );
          }
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Inserta o actualiza un registro.
 */
export async function setToDB<T>(
  storeName: string,
  value: T
): Promise<IDBValidKey> {
  const db = await getDB();
  return db.put(storeName, value);
}

/**
 * Obtiene un registro por su key.
 */
export async function getFromDB<T>(
  storeName: string,
  key: IDBValidKey
): Promise<T | undefined> {
  const db = await getDB();
  return db.get(storeName, key);
}

/**
 * Elimina un registro.
 */
export async function deleteFromDB(
  storeName: string,
  key: IDBValidKey
): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, key);
}

/**
 * Limpia un store completo.
 */
export async function clearStore(storeName: string): Promise<void> {
  const db = await getDB();
  await db.clear(storeName);
}

/**
 * Consulta registros con filtros simples sobre la key principal o un índice.
 */
export async function queryFromDB<T>(
  storeName: string,
  filter: QueryFilter,
  indexName?: string
): Promise<T[]> {
  const db = await getDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const source = indexName ? store.index(indexName) : store;

  if (filter.type === "contains") {
    const searchValue = filter.value.toLowerCase();
    const field = filter.field;

    const results: T[] = [];
    let cursor = await source.openCursor();
    while (cursor) {
      const value = cursor.value as any;
      let fieldValue: string;

      if (field) {
        fieldValue = String(value[field] ?? "").toLowerCase();
      } else if (indexName) {
        fieldValue = String(cursor.key).toLowerCase();
      } else {
        // fallback: intentar usar keyPath principal
        fieldValue = String(cursor.key).toLowerCase();
      }

      if (fieldValue.includes(searchValue)) {
        results.push(cursor.value as T);
      }
      cursor = await cursor.continue();
    }

    await tx.done;
    return results;
  }

  let range: IDBKeyRange | null = null;
  switch (filter.type) {
    case "exact":
      range = IDBKeyRange.only(filter.value);
      break;
    case "prefix": {
      const lower = filter.value;
      const upper = lower + "\uffff";
      range = IDBKeyRange.bound(lower, upper);
      break;
    }
    case "gte":
      range = IDBKeyRange.lowerBound(filter.value);
      break;
    case "lte":
      range = IDBKeyRange.upperBound(filter.value);
      break;
    case "gt":
      range = IDBKeyRange.lowerBound(filter.value, true);
      break;
    case "lt":
      range = IDBKeyRange.upperBound(filter.value, true);
      break;
  }

  const results: T[] = [];
  let cursor = await source.openCursor(range);
  while (cursor) {
    results.push(cursor.value as T);
    cursor = await cursor.continue();
  }

  await tx.done;
  return results;
}
