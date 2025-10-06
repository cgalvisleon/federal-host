import App from "@/App.tsx";
import { PluginRegistryProvider } from "@/plugins/registry";
import "@/styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PluginRegistryProvider>
      <App />
    </PluginRegistryProvider>
  </StrictMode>
);
