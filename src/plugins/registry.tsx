import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

type Plugin = {
  module?: string;
  name: string;
  version: string;
  tag: string;
  component?: React.ComponentType<any>;
  element?: ReactNode;
};

type RegistryContextType = {
  plugins: Plugin[];
  registerPlugin: (plugin: Plugin) => void;
  getComponentByTag: (tag: string) => React.ComponentType<any>;
  getElementByTag: (tag: string) => ReactNode;
};

const RegistryContext = createContext<RegistryContextType | undefined>(
  undefined
);

export const DefaultNotFound: React.FC = () => <h1>Not found component</h1>;

export const PluginRegistryProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);

  const registerPlugin = (plugin: Plugin) => {
    setPlugins((prev) => {
      const existing = prev.find((p) => p.tag === plugin.tag);
      if (!existing) {
        return [...prev, plugin];
      }

      if (existing.version !== plugin.version) {
        return prev.map((p) => (p.tag === plugin.tag ? plugin : p));
      }

      return prev;
    });
  };

  const getComponentByTag = (tag: string): React.ComponentType<any> => {
    const found = plugins.find((p) => p.tag === tag);
    return found?.component ?? DefaultNotFound;
  };

  const getElementByTag = (tag: string): ReactNode => {
    const found = plugins.find((p) => p.tag === tag);
    return found?.element ?? <DefaultNotFound />;
  };

  return (
    <RegistryContext.Provider
      value={{ plugins, registerPlugin, getComponentByTag, getElementByTag }}
    >
      {children}
    </RegistryContext.Provider>
  );
};

export const usePluginRegistry = () => {
  const context = useContext(RegistryContext);
  if (!context)
    throw new Error(
      "usePluginRegistry must be used inside PluginRegistryProvider"
    );
  return context;
};

export async function loadPlugin(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.type = "module";
    script.async = true;

    script.onload = async () => {
      try {
        const mod = await import(/* @vite-ignore */ url);
        resolve(mod);
      } catch (err) {
        reject(err);
      }
    };

    script.onerror = () => reject(new Error(`Error loading plugin: ${url}`));
    document.head.appendChild(script);
  });
}
