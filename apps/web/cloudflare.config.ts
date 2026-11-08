import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "indicorica-web",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-08",
    // global_fetch_strictly_public: lets this Worker call the API Worker by its public workers.dev URL
// (otherwise same-account Worker-to-Worker fetches get a 404 / error 1042).
compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
});
