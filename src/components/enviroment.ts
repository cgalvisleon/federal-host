export const enviroment = {
  Debug: import.meta.env.VITE_DEBUG ?? false,
  NodeEnv: import.meta.env.VITE_ENV ?? "development",
  AppName: import.meta.env.VITE_APP_NAME ?? "",
  AppVersion: import.meta.env.VITE_APP_VERSION ?? "v0.0.0",
  ApiURL: import.meta.env.VITE_URL_API ?? "http://localhost:3300/api",
  Company: import.meta.env.VITE_COMPANY ?? "",
  Copyright: import.meta.env.VITE_COPYRIGHT ?? "© 2025",
  ProjectId: import.meta.env.VITE_PROJECT_ID ?? "-1",
  TokenTest: import.meta.env.VITE_TOKENT_TEST ?? "",
  DbName: import.meta.env.VITE_DB_NAME ?? "myAppDB",
  DbVersion: import.meta.env.VITE_DB_VERSION ?? "1",
};
