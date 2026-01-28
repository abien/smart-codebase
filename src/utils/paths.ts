import * as os from "os";
import { join } from "path";

export function getOpenCodeConfigDir(): string {
  const home = os.homedir();
  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "opencode");
  }
  return join(process.env.XDG_CONFIG_HOME || join(home, ".config"), "opencode");
}
