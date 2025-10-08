import { ensureStore, queryFromDB } from "@/components/db";
import { create } from "zustand";

export interface Codi {
  root: string;
  search: string;
  result: Record<string, any>;
}

interface CodiState {
  codis: Codi[];
  loadingCodis: boolean;
}

const STORE_NAME = "codis";

ensureStore(STORE_NAME, {
  keyPath: "id",
  autoIncrement: false,
  indexes: [{ name: "email", keyPath: "email", unique: true }],
});

export const useCodiStore = create<CodiState>((set) => {
  const store: CodiState = {
    codis: [],
    loadingCodis: false,
  };

  (async () => {
    const stored = await queryFromDB<Codi>(STORE_NAME, {
      type: "moreEq",
      value: "",
    });
    set({ codis: stored });
  })();

  return store;
});
