import { loadPlugin, usePluginRegistry } from "@/plugins/registry";
import { useUserStore } from "@/store/useAppStore";
import "@/styles/App.css";
import { connect, StringCodec } from "nats.ws";
import React, { useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

function PluginRoutes() {
  const { plugins } = usePluginRegistry();

  return (
    <Routes>
      <Route path="/" element={<h1>Main</h1>} />
      {plugins.map((p, i) => {
        const route = "/" + p.name;
        return <Route key={i} path={route} Component={p.component} />;
      })}
    </Routes>
  );
}

function Navigation() {
  const { plugins } = usePluginRegistry();

  return (
    <nav style={{ marginBottom: "1rem" }}>
      <Link to="/">Home</Link>
      {plugins.map((p, i) => {
        const route = "/" + p.name;
        return (
          <Link key={i} to={route}>
            {` | ${p.name}`}
          </Link>
        );
      })}
    </nav>
  );
}

function PluginsLoader() {
  const { registerPlugin } = usePluginRegistry();

  useEffect(() => {
    async function fetchPlugins() {
      try {
        const res = await fetch("/plugins.json"); // Archivo estático o servido desde backend
        const plugins = await res.json();

        for (const plugin of plugins) {
          const mod = await loadPlugin(plugin.url);
          for (const name of Object.keys(mod)) {
            const component = mod[name];
            const element = React.createElement(component);
            const version = component.version || "0.0.0";
            const tag = `${plugin.name}.${name}`;
            registerPlugin({
              module: plugin.name,
              name: name,
              version: version,
              tag: tag,
              component: component,
              element: element,
            });
          }
        }
      } catch (err) {
        console.error("Error loading plugins", err);
      }
    }

    fetchPlugins();
  }, []);

  return null; // no renderiza nada, solo registra plugins
}

function App() {
  const { getComponentByTag } = usePluginRegistry();
  const Hello = getComponentByTag("MyPlugin.HelloPlugin");
  const [messages, setMessages] = useState<string[]>([]);
  const { users, setUser, clearUsers, loading } = useUserStore();

  useEffect(() => {
    async function initWs() {
      try {
        const nc = await connect({ servers: "ws://localhost:9222" });
        const sc = StringCodec();

        // Suscribirse a un tema
        const sub = nc.subscribe("chat");
        (async () => {
          for await (const m of sub) {
            const msg = sc.decode(m.data);
            setMessages((prev) => [...prev, msg]);
          }
        })();

        // Publicar un mensaje cada 5 segundos
        setInterval(() => {
          nc.publish("chat", sc.encode("Hola desde React!"));
        }, 5000);
      } catch (err) {
        console.error("Error al conectar con NATS:", err);
      }
    }

    // initWs();
  }, []);

  const handleSetUser = async () => {
    await setUser("César", "cesar@cesar.com");
    // await setUser("César", "cesar@galvis.com");
  };

  const handleClearUsers = async () => {
    await clearUsers();
  };

  return (
    <BrowserRouter>
      <PluginsLoader />
      <Navigation />
      <PluginRoutes />
      <Hello />
      <div className="p-4">
        <h1 className="text-xl font-bold">Zustand + IndexedDB (Auto)</h1>

        <button
          className="px-4 py-2 bg-blue-500 text-white rounded mr-2"
          onClick={() => setUser("César", `cesar${users.length}@example.com`)}
        >
          Añadir usuario
        </button>

        <button
          className="px-4 py-2 bg-red-500 text-white rounded"
          onClick={clearUsers}
        >
          Limpiar
        </button>

        {loading && <p>Cargando usuarios...</p>}

        <ul className="mt-4">
          {users.map((u) => (
            <li key={u.id}>
              {u.name} — {u.email}
            </li>
          ))}
        </ul>
      </div>
      {/*  */}
      <div>
        <h1>Mensajes de NATS</h1>
        <ul>
          {messages.map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
      </div>
    </BrowserRouter>
  );
}

export default App;
