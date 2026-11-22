import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const electron = require("electron");
const main = fileURLToPath(new URL("./dist/main.js", import.meta.url));
const forwardedArgs = process.argv.slice(2).filter((argument) => argument !== "--");

// Ozone precisa ser recebido antes do entrypoint; depois de main.js o
// Chromium já inicializou a plataforma de janelas.
const child = spawn(electron, [...forwardedArgs, main], {
  cwd: path.resolve(path.dirname(main), "../.."),
  env: { ...process.env, VECTORA_DEV_BACKEND: "source" },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("Não foi possível iniciar o Electron:", error);
  process.exit(1);
});
