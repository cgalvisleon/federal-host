import { clearStore, ensureStore, queryFromDB, setToDB } from "@/components/db";
import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";

export interface User {
  id: string;
  name: string;
  email: string;
}

interface UserState {
  users: User[];
  loading: boolean;
  setUser: (name: string, email: string) => Promise<void>;
  queryUsers: () => Promise<void>;
  clearUsers: () => Promise<void>;
}

const STORE_NAME = "users";

// Aseguramos el store en IndexedDB
ensureStore(STORE_NAME, {
  keyPath: "id",
  autoIncrement: false,
  indexes: [{ name: "email", keyPath: "email", unique: true }],
});

export const useUserStore = create<UserState>((set, get) => {
  const store: UserState = {
    users: [],
    loading: false,

    setUser: async (name, email) => {
      const newUser: User = { id: uuidv4(), name, email };
      await setToDB(STORE_NAME, newUser);
      set((state) => ({ users: [...state.users, newUser] }));
    },

    queryUsers: async () => {
      set({ loading: true });
      const stored = await queryFromDB<User>(STORE_NAME, {
        type: "gte",
        value: "",
      });
      set({ users: stored, loading: false });
    },

    clearUsers: async () => {
      await clearStore(STORE_NAME);
      set({ users: [] });
    },
  };

  (async () => {
    const stored = await queryFromDB<User>(STORE_NAME, {
      type: "gte",
      value: "",
    });
    set({ users: stored });
  })();

  return store;
});
