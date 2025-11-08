import { defineConfig, mergeConfig } from "vite";
import path from "path";
import baseConfig from "../vite.config";

export default defineConfig((ctx) => {
  const resolvedBase =
    typeof baseConfig === "function" ? baseConfig(ctx) : baseConfig;

  return mergeConfig(resolvedBase, {
    root: __dirname,
    envDir: path.resolve(__dirname, ".."),
    server: {
      ...(resolvedBase.server ?? {}),
      host: "::",
      port: 3001,
    },
    resolve: {
      ...(resolvedBase.resolve ?? {}),
      alias: {
        ...(resolvedBase.resolve?.alias ?? {}),
        "@": path.resolve(__dirname, "./src"),
      },
    },
  });
});

