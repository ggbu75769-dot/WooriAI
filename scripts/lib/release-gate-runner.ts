import { spawnSync } from "node:child_process";
import { basename } from "node:path";

export type GateCommand = {
  id: string;
  label: string;
  display: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
};

export type GateResult = GateCommand & {
  durationMs: number;
  status: number | null;
  stdout: string;
  stderr: string;
};

export function packageManagerInvocation(
  args: string[],
  env = process.env,
  platform = process.platform,
  node = process.execPath
) {
  const candidate = env.npm_execpath;
  const cli = candidate && /^pnpm(?:\.c?js)?$/i.test(basename(candidate)) ? candidate : undefined;
  if (cli) return { executable: node, args: [cli, ...args] };
  if (platform === "win32") {
    return {
      executable: env.ComSpec ?? "cmd.exe",
      args: ["/d", "/s", "/c", "pnpm.cmd", ...args]
    };
  }
  return { executable: "pnpm", args };
}

export function runGateCommand(command: GateCommand): GateResult {
  const startedAt = Date.now();
  const invocation = packageManagerInvocation(command.args);
  const result = spawnSync(invocation.executable, invocation.args, {
    cwd: process.cwd(),
    env: { ...process.env, ...command.env },
    // Large test logs must stream without spawnSync's captured-output buffer limit.
    stdio: "inherit"
  });
  return {
    ...command,
    durationMs: Date.now() - startedAt,
    status: result.status ?? 1,
    stdout: "",
    stderr: result.error ? String(result.error) : ""
  };
}

export function runGatePlan(commands: GateCommand[], run: (command: GateCommand) => GateResult): GateResult[] {
  let failed = false;
  return commands.map((command) => {
    if (failed)
      return {
        ...command,
        durationMs: 0,
        status: null,
        stdout: "",
        stderr: ""
      };
    const result = run(command);
    failed = result.status !== 0;
    return result;
  });
}
