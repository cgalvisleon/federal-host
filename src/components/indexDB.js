import { enviroment } from "@/components/enviroment";
import { openDB } from "idb";

const DB_NAME = enviroment.DbName;
let DB_VERSION = enviroment.DbVersion;

let dbPromise = null;
let storesToEnsure = {};

/**
 * Registra stores que se crearán si no existen.
 */
export function ensureStore(storeName, definition) {
  const hasFulltextIndex = definition.indexes?.some(
    (idx) => idx.name === "__fulltext"
  );
  if (!hasFulltextIndex) {
    definition.indexes = [
      ...(definition.indexes ?? []),
      { name: "__fulltext", keyPath: "__fulltext" },
    ];
  }
  storesToEnsure[storeName] = definition;
}

/**
 * Inicializa la base de datos creando los stores que falten.
 */
async function getDB() {
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
 * Genera el campo __fulltext concatenando todos los valores stringificables del objeto.
 */
function buildFullText(obj, excludeKey) {
  const values = [];

  function recurse(o) {
    if (o == null) return;

    if (typeof o === "object") {
      for (const [key, val] of Object.entries(o)) {
        if (key === excludeKey) continue;
        recurse(val);
      }
    } else if (["string", "number", "boolean"].includes(typeof o)) {
      values.push(String(o));
    }
  }

  recurse(obj);
  return values.join("|").toLowerCase();
}

/**
 * Inserta o actualiza un registro.
 */
export async function setToDB(storeName, value) {
  const storeDef = storesToEnsure[storeName];
  const keyToExclude = storeDef?.keyPath;

  value.__fulltext = buildFullText(value, keyToExclude);

  const db = await getDB();
  return db.put(storeName, value);
}

/**
 * Obtiene un registro por su key.
 */
export async function getFromDB(storeName, key) {
  const db = await getDB();
  return db.get(storeName, key);
}

/**
 * Elimina un registro.
 */
export async function deleteFromDB(storeName, key) {
  const db = await getDB();
  await db.delete(storeName, key);
}

/**
 * Limpia un store completo.
 */
export async function clearStore(storeName) {
  const db = await getDB();
  await db.clear(storeName);
}

/**
 * Consulta registros con filtros simples sobre la key principal o un índice.
 */
export async function queryFromDB(storeName, filter, indexName, options) {
  const db = await getDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const source = indexName ? store.index(indexName) : store;
  const page = options?.page ?? 1;
  const rows = options?.rows ?? 30;
  const offset = (page - 1) * rows;

  if (filter.type === "like") {
    const searchValue = filter.value.toLowerCase();
    const field = filter.field;

    const results = [];
    let cursor = await source.openCursor();

    if (cursor && offset > 0) {
      await cursor.advance(offset);
    }

    while (cursor && results.length < rows) {
      const value = cursor.value;
      let fieldValue;

      if (field) {
        fieldValue = String(value[field] ?? "").toLowerCase();
      } else if (indexName) {
        fieldValue = String(cursor.key).toLowerCase();
      } else {
        fieldValue = String(cursor.key).toLowerCase();
      }

      if (fieldValue.includes(searchValue)) {
        results.push(cursor.value);
      }
      cursor = await cursor.continue();
    }

    await tx.done;
    return results;
  }

  let range = null;
  switch (filter.type) {
    case "eq":
      range = IDBKeyRange.only(filter.value);
      break;
    case "prefix": {
      const lower = filter.value;
      const upper = lower + "\uffff";
      range = IDBKeyRange.bound(lower, upper);
      break;
    }
    case "moreEq":
      range = IDBKeyRange.lowerBound(filter.value);
      break;
    case "lessEq":
      range = IDBKeyRange.upperBound(filter.value);
      break;
    case "more":
      range = IDBKeyRange.lowerBound(filter.value, true);
      break;
    case "less":
      range = IDBKeyRange.upperBound(filter.value, true);
      break;
  }

  const results = [];
  let cursor = await source.openCursor(range);

  if (cursor && offset > 0) {
    await cursor.advance(offset);
  }

  while (cursor && results.length < rows) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return results;
}

/**
 * Busca registros en un store utilizando el índice __fulltext.
 */
export async function searchFromDB(storeName, value, page = 1, rows = 30) {
  return queryFromDB(storeName, { type: "like", value }, "__fulltext", {
    page,
    rows,
  });
}
