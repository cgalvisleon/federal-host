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

export const DEAL_STEPS = [
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

const STORE_NAME = "deals";
const USER_ID = "cesar@example.com";

ensureStore(STORE_NAME, {
  keyPath: "id",
  autoIncrement: false,
  indexes: [{ name: "code", keyPath: "code", unique: true }],
});

export const useDealStore = create((set) => {
  const store = {
    deals: [],
    loadingDeals: false,

    setDeal: async (id, step, data, req, pinnedData) => {
      const dealId = id.trim() === "" ? uuidv4() : id;
      const existingDeal = await getFromDB(STORE_NAME, dealId);
      const now = new Date();
      const stepInfo = DEAL_STEPS.find((s) => s.step === step);
      let newDeal;

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
              req,
              res: {},
              pinnedData,
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
              req,
              res: {},
              pinnedData,
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

      const existingDeal = await getFromDB(STORE_NAME, id);
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
            res,
          };
        } else {
          steps.push({
            step,
            title: stepInfo?.title ?? "",
            subtitle: stepInfo?.subtitle ?? "",
            res,
            pinnedData: {},
          });
        }

        const updatedDeal = {
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

    getDeal: async (id) => {
      const stored = await getFromDB(STORE_NAME, id);
      return stored;
    },

    deleteDeal: async (id) => {
      await deleteFromDB(STORE_NAME, id);
      set((state) => ({ deals: state.deals.filter((deal) => deal.id !== id) }));
    },

    queryDeals: async (field, value, page, rows) => {
      set({ loadingDeals: true });
      const stored = await queryFromDB(
        STORE_NAME,
        {
          type: "like",
          field,
          value,
        },
        undefined,
        { page, rows }
      );
      set({ deals: stored, loadingDeals: false });
    },

    searchDeal: async (value, page, rows) => {
      set({ loadingDeals: true });
      const stored = await queryFromDB(
        STORE_NAME,
        {
          type: "like",
          field: "__fulltext",
          value,
        },
        "__fulltext",
        { page, rows }
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

  // Cargar deals almacenados al inicializar
  (async () => {
    const stored = await queryFromDB(STORE_NAME, {
      type: "moreEq",
      value: "",
    });
    set({ deals: stored });
  })();

  return store;
});
