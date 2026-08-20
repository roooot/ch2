import { spawn } from "node:child_process";

const shouldRunMigrations = process.env.RUN_PRISMA_MIGRATIONS === "true";

if (!shouldRunMigrations) {
  console.log("Skipping Prisma migrations (RUN_PRISMA_MIGRATIONS is not true).");
  process.exit(0);
}

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const migration = spawn(npxCommand, ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
});

migration.on("error", (error) => {
  console.error("Could not start Prisma migrations:", error);
  process.exitCode = 1;
});

migration.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
