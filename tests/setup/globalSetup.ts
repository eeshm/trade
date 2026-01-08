import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

async function setup() {
  process.env.NODE_ENV = "test";
  process.env.TZ = process.env.TZ ?? "UTC";

  const cwd = process.cwd();
  const testEnvPath = path.resolve(cwd, ".env.test");
  const defaultEnvPath = path.resolve(cwd, ".env");

  if (fs.existsSync(testEnvPath)) {
    config({ path: testEnvPath, override: true });
  } else if (fs.existsSync(defaultEnvPath)) {
    config({ path: defaultEnvPath, override: false });
  }
}

export { setup };
export default setup;
