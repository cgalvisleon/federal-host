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

export interface User {
  id: string;
  name: string;
  email: string;
}

interface UserState {
  users: User[];
  loadingUsers: boolean;
  setUser: (id: string, name: string, email: string) => Promise<void>;
  getUser: (id: string) => Promise<User | undefined>;
  deleteUser: (id: string) => Promise<void>;
  queryUsers: (
    field: string,
    value: string,
    page?: number,
    rows?: number
  ) => Promise<void>;
  searchUser: (value: string, page?: number, rows?: number) => Promise<void>;
  clearUsers: () => Promise<void>;
}

const STORE_NAME = "users";

ensureStore(STORE_NAME, {
  keyPath: "id",
  autoIncrement: false,
  indexes: [{ name: "email", keyPath: "email", unique: true }],
});

export const useUserStore = create<UserState>((set) => {
  const store: UserState = {
    users: [],
    loadingUsers: false,

    setUser: async (id, name, email) => {
      if (id == "") {
        id = uuidv4();
      }
      const newUser: User = { id, name, email };
      await setToDB(STORE_NAME, newUser);
      set((state) => ({ users: [...state.users, newUser] }));
    },

    getUser: async (id: string) => {
      const stored = await getFromDB<User>(STORE_NAME, id);
      return stored;
    },

    deleteUser: async (id: string) => {
      await deleteFromDB(STORE_NAME, id);
      set((state) => ({ users: state.users.filter((user) => user.id !== id) }));
    },

    queryUsers: async (
      field: string,
      value: string,
      page?: number,
      rows?: number
    ) => {
      set({ loadingUsers: true });
      const stored = await queryFromDB<User>(
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
      set({ users: stored, loadingUsers: false });
    },

    searchUser: async (value: string, page?: number, rows?: number) => {
      set({ loadingUsers: true });
      const stored = await queryFromDB<User>(
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
      set({ users: stored, loadingUsers: false });
    },

    clearUsers: async () => {
      await clearStore(STORE_NAME);
      set({ users: [] });
    },
  };

  (async () => {
    const stored = await queryFromDB<User>(STORE_NAME, {
      type: "moreEq",
      value: "",
    });
    set({ users: stored });
  })();

  return store;
});
