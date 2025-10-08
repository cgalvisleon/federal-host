import {
  clearStore,
  deleteFromDB,
  ensureStore,
  getFromDB,
  queryFromDB,
  setToDB,
} from "@/components/db";
import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";

export interface Deal {
  id: string;
  name: string;
  email: string;
}

interface DealState {
  deals: Deal[];
  loadingDeals: boolean;
  setDeal: (id: string, name: string, email: string) => Promise<void>;
  getDeal: (id: string) => Promise<Deal | undefined>;
  deleteDeal: (id: string) => Promise<void>;
  queryDeals: (
    field: string,
    value: string,
    page?: number,
    rows?: number
  ) => Promise<void>;
  searchDeal: (value: string, page?: number, rows?: number) => Promise<void>;
  clearDeals: () => Promise<void>;
}

const STORE_NAME = "deals";

ensureStore(STORE_NAME, {
  keyPath: "id",
  autoIncrement: false,
  indexes: [{ name: "email", keyPath: "email", unique: true }],
});

export const useDealStore = create<DealState>((set) => {
  const store: DealState = {
    deals: [],
    loadingDeals: false,

    setDeal: async (id, name, email) => {
      if (id == "") {
        id = uuidv4();
      }
      const newDeal: Deal = { id, name, email };
      await setToDB(STORE_NAME, newDeal);
      set((state) => ({ deals: [...state.deals, newDeal] }));
    },

    getDeal: async (id: string) => {
      const stored = await getFromDB<Deal>(STORE_NAME, id);
      return stored;
    },

    deleteDeal: async (id: string) => {
      await deleteFromDB(STORE_NAME, id);
      set((state) => ({ deals: state.deals.filter((deal) => deal.id !== id) }));
    },

    queryDeals: async (
      field: string,
      value: string,
      page?: number,
      rows?: number
    ) => {
      set({ loadingDeals: true });
      const stored = await queryFromDB<Deal>(
        STORE_NAME,
        {
          type: "like",
          field: field,
          value: value,
        },
        undefined,
        {
          page: page,
          rows: rows,
        }
      );
      set({ deals: stored, loadingDeals: false });
    },

    searchDeal: async (value: string, page?: number, rows?: number) => {
      set({ loadingDeals: true });
      const stored = await queryFromDB<Deal>(
        STORE_NAME,
        {
          type: "like",
          field: "__fulltext",
          value: value,
        },
        "__fulltext",
        {
          page: page,
          rows: rows,
        }
      );
      set({ deals: stored, loadingDeals: false });
    },

    clearDeals: async () => {
      await clearStore(STORE_NAME);
      set({ deals: [] });
    },
  };

  (async () => {
    const stored = await queryFromDB<Deal>(STORE_NAME, {
      type: "moreEq",
      value: "",
    });
    set({ deals: stored });
  })();

  return store;
});
