import {
  clearStore,
  deleteFromDB,
  ensureStore,
  getFromDB,
  queryFromDB,
  setToDB,
} from "@/components/db";
import type { FC } from "react";
import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";

interface DealStep {
  step: number;
  title: string;
  subtitle: string;
  url: string;
  component?: FC<any>;
}

export const DEAL_STEPS: DealStep[] = [
  {
    step: 1,
    title: "Datos del cliente",
    subtitle: "",
    url: "/octopus/flows/init",
    component: undefined,
  },
  {
    step: 2,
    title: "Datos del producto",
    subtitle: "",
    url: "/octopus/flows/init",
    component: undefined,
  },
];

export interface Step {
  step: number;
  title: string;
  subtitle: string;
  data?: Record<string, any>;
  req?: Record<string, any>;
  res?: Record<string, any>;
  pinnedData?: Record<string, any>;
}

export interface Deal {
  createdAt: Date;
  updateAt: Date;
  status: string;
  id: string;
  code: string;
  title: string;
  subtitle: string;
  userId: string;
  currentStep: Number;
  steps: Step[];
}

interface DealActionResult {
  ok: boolean;
  deal?: Deal;
  error?: string;
}

interface DealState {
  deals: Deal[];
  loadingDeals: boolean;
  setDeal: (
    id: string,
    step: number,
    data: Record<string, any>,
    req: Record<string, any>,
    pinnedData: Record<string, any>
  ) => Promise<DealActionResult>;
  setResDeal: (
    id: string,
    step: number,
    res: Record<string, any>
  ) => Promise<DealActionResult>;
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
  processDealStep: (
    id: string,
    step: number,
    data: Record<string, any>,
    req: Record<string, any>,
    pinnedData: Record<string, any>
  ) => Promise<DealActionResult>;
}

const STORE_NAME = "deals";
const USER_ID = "cesar@example.com";

ensureStore(STORE_NAME, {
  keyPath: "id",
  autoIncrement: false,
  indexes: [{ name: "code", keyPath: "code", unique: true }],
});

export const useDealStore = create<DealState>((set) => {
  const store: DealState = {
    deals: [],
    loadingDeals: false,

    setDeal: async (id, step, data, req, pinnedData) => {
      const dealId = id.trim() === "" ? uuidv4() : id;
      const existingDeal = await getFromDB<Deal>(STORE_NAME, dealId);
      const now = new Date();
      const stepInfo = DEAL_STEPS.find((s) => s.step === step);
      let newDeal: Deal;

      if (existingDeal) {
        newDeal = {
          ...existingDeal,
          updateAt: now,
          steps: [
            ...existingDeal.steps,
            {
              step,
              data,
              title: stepInfo?.title ?? "",
              subtitle: stepInfo?.subtitle ?? "",
              req: req,
              res: {},
              pinnedData: pinnedData,
            },
          ],
        };
      } else {
        newDeal = {
          createdAt: now,
          updateAt: now,
          status: "pending",
          id: dealId,
          code: "",
          title: "Oportunidad de venta",
          subtitle: "",
          userId: USER_ID,
          currentStep: step,
          steps: [
            {
              step,
              data,
              title: "",
              subtitle: "",
              req: req,
              res: {},
              pinnedData: pinnedData,
            },
          ],
        };
      }

      await setToDB(STORE_NAME, newDeal);
      set((state) => {
        const existingIndex = state.deals.findIndex((d) => d.id === newDeal.id);
        if (existingIndex >= 0) {
          const updated = [...state.deals];
          updated[existingIndex] = newDeal;
          return { deals: updated };
        }
        return { deals: [...state.deals, newDeal] };
      });

      return { ok: true, deal: newDeal };
    },

    setResDeal: async (id, step, res) => {
      if (!id || id.trim() === "") {
        return { ok: false, error: "El ID de la oportunidad es obligatorio." };
      }

      const existingDeal = await getFromDB<Deal>(STORE_NAME, id);
      if (!existingDeal) {
        return {
          ok: false,
          error: `No se encontró la oportunidad con ID: ${id}`,
        };
      }

      try {
        const now = new Date();
        const stepInfo = DEAL_STEPS.find((s) => s.step === step);
        const steps = [...existingDeal.steps];
        const stepIndex = steps.findIndex((s) => s.step === step);

        if (stepIndex >= 0) {
          steps[stepIndex] = {
            ...steps[stepIndex],
            title: stepInfo?.title ?? steps[stepIndex].title,
            subtitle: stepInfo?.subtitle ?? steps[stepIndex].subtitle,
            res: res,
          };
        } else {
          steps.push({
            step,
            title: stepInfo?.title ?? "",
            subtitle: stepInfo?.subtitle ?? "",
            res: res,
            pinnedData: {},
          });
        }

        const updatedDeal: Deal = {
          ...existingDeal,
          updateAt: now,
          steps,
          currentStep: step,
        };

        await setToDB(STORE_NAME, updatedDeal);
        set((state) => {
          const existingIndex = state.deals.findIndex(
            (d) => d.id === updatedDeal.id
          );
          if (existingIndex >= 0) {
            const updated = [...state.deals];
            updated[existingIndex] = updatedDeal;
            return { deals: updated };
          }
          return { deals: [...state.deals, updatedDeal] };
        });

        return { ok: true, deal: updatedDeal };
      } catch (error) {
        console.error("Error al actualizar el deal:", error);
        return { ok: false, error: "Error al actualizar el deal" };
      }
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

    processDealStep: async (id, step, data, req, pinnedData) => {
      try {
        const stepInfo = DEAL_STEPS.find((s) => s.step === step);
        if (!stepInfo) {
          return {
            ok: false,
            error: `No existe definición para el step ${step}`,
          };
        }

        let dealResult = await store.setDeal(id, step, data, req, pinnedData);
        if (!dealResult.ok) {
          return {
            ok: false,
            error: `Error guardando deal: ${dealResult.error}`,
          };
        }

        const response = await fetch(stepInfo.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.REACT_APP_API_KEY}`,
          },
          body: JSON.stringify(req),
        });

        if (!response.ok) {
          return {
            ok: false,
            error: `Error en la petición: ${response.status}`,
          };
        }

        const res = await response.json();
        dealResult = await store.setResDeal(id, step, res);
        if (!dealResult.ok) {
          return {
            ok: false,
            error: `Error guardando deal: ${dealResult.error}`,
          };
        }

        return { ok: true, deal: dealResult.deal };
      } catch (error) {
        console.error("Error al procesar el paso del deal:", error);
        return { ok: false, error: "Error al procesar el paso del deal" };
      }
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
