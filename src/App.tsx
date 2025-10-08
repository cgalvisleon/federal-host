import { loadPlugin, usePluginRegistry } from "@/plugins/registry";
import { useUserStore } from "@/store/useAppStore";
import "@/styles/App.css";
import { connect, StringCodec } from "nats.ws";
import React, { useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { useDealStore } from "./store/dealAppStore";

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

  return (
    <BrowserRouter>
      <PluginsLoader />
      <Navigation />
      <PluginRoutes />
      <Hello />
      <User />
      <Deal />
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

function User() {
  const {
    users,
    setUser,
    clearUsers,
    loadingUsers,
    getUser,
    deleteUser,
    searchUser,
  } = useUserStore();
  const [searchTerm, setSearchTerm] = useState("");

  const handleSetUser = async (id: string, name: string, email: string) => {
    await setUser(id, name, email);
  };

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(searchTerm);
    await searchUser(searchTerm, 1, 20);
  };

  const handleGetUser = async (id: string) => {
    const user = await getUser(id);
    if (user) {
      alert(
        `📄 Usuario:\n\nID: ${user.id}\nNombre: ${user.name}\nEmail: ${user.email}`
      );
    } else {
      alert("Usuario no encontrado");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm("¿Seguro que deseas eliminar este usuario?")) {
      await deleteUser(id);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="p-4">
        <h1 className="text-xl font-bold">Zustand + IndexedDB (Auto)</h1>

        <button
          className="px-4 py-2 bg-blue-500 text-white rounded mr-2"
          onClick={() =>
            handleSetUser("", "César", `cesar${users.length}@example.com`)
          }
        >
          Añadir usuario
        </button>

        <button
          className="px-4 py-2 bg-red-500 text-white rounded"
          onClick={clearUsers}
        >
          Limpiar
        </button>
      </div>
      {/* 🔍 Formulario de búsqueda */}
      <form onSubmit={handleSearchUser} className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar usuarios..."
          className="flex-1 border rounded p-2"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Buscar
        </button>
      </form>

      {/* ⏳ Loading */}
      {loadingUsers && <p className="text-gray-500">Cargando...</p>}

      {/* 📋 Lista de usuarios */}
      {!loadingUsers && users.length === 0 && (
        <p className="text-gray-500">No se encontraron usuarios.</p>
      )}

      <ul className="divide-y divide-gray-200">
        {users.map((user) => (
          <li key={user.id} className="flex justify-between items-center py-2">
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleGetUser(user.id)}
                className="text-blue-600 hover:underline"
              >
                Ver
              </button>
              <button
                onClick={() => handleDeleteUser(user.id)}
                className="text-red-600 hover:underline"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Deal() {
  const {
    deals,
    setDeal,
    clearDeals,
    loadingDeals,
    getDeal,
    deleteDeal,
    searchDeal,
  } = useDealStore();
  const [searchTerm, setSearchTerm] = useState("");

  const handleSetDeal = async (
    id: string,
    step: number,
    data: Record<string, any>,
    req: Record<string, any>,
    pinnedData: Record<string, any>
  ) => {
    await setDeal(id, step, data, req, pinnedData);
  };

  const handleSearchDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(searchTerm);
    await searchDeal(searchTerm, 1, 20);
  };

  const handleGetDeal = async (id: string) => {
    const deal = await getDeal(id);
    if (deal) {
      alert(
        `📄 Deal:\n\nID: ${deal.id}\nCode: ${deal.code}\nTitle: ${deal.title}\nSubtitle: ${deal.subtitle}\nUser ID: ${deal.userId}`
      );
    } else {
      alert("Deal no encontrado");
    }
  };

  const handleDeleteDeal = async (id: string) => {
    if (confirm("¿Seguro que deseas eliminar este deal?")) {
      await deleteDeal(id);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="p-4">
        <h1 className="text-xl font-bold">Zustand + IndexedDB (Auto)</h1>

        <button
          className="px-4 py-2 bg-blue-500 text-white rounded mr-2"
          onClick={() => handleSetDeal("", 1, { name: "César" }, {}, {})}
        >
          Añadir deals
        </button>

        <button
          className="px-4 py-2 bg-red-500 text-white rounded"
          onClick={clearDeals}
        >
          Limpiar
        </button>
      </div>
      <form onSubmit={handleSearchDeal} className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar usuarios..."
          className="flex-1 border rounded p-2"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Buscar
        </button>
      </form>

      {loadingDeals && <p className="text-gray-500">Cargando...</p>}

      {!loadingDeals && deals.length === 0 && (
        <p className="text-gray-500">No se encontraron usuarios.</p>
      )}

      <ul className="divide-y divide-gray-200">
        {deals.map((deal) => (
          <li key={deal.id} className="flex justify-between items-center py-2">
            <div>
              <p className="font-semibold">{deal.code}</p>
              <p className="text-sm text-gray-600">{deal.title}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleGetDeal(deal.id)}
                className="text-blue-600 hover:underline"
              >
                Ver
              </button>
              <button
                onClick={() => handleDeleteDeal(deal.id)}
                className="text-red-600 hover:underline"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
