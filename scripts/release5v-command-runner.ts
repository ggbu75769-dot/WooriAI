import { spawnSync } from "node:child_process";

export function runPortableCommand(
  command: string,
  args: string[],
  options: { cwd: string; encoding?: BufferEncoding | null; maxBuffer?: number }
) {
  const usesWindowsBatchWrapper = process.platform === "win32" && /\.(?:bat|cmd)$/i.test(command);
  const executable = usesWindowsBatchWrapper ? process.env.ComSpec || "cmd.exe" : command;
  const executableArgs = usesWindowsBatchWrapper ? ["/d", "/s", "/c", "call", command, ...args] : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: options.cwd,
    encoding: options.encoding === undefined ? "utf8" : options.encoding,
    shell: false,
    maxBuffer: options.maxBuffer ?? 128 * 1024 * 1024
  });
  if (result.status !== 0 || result.error) {
    throw new Error(`${command} ${args.join(" ")} failed\n${String(result.stderr ?? result.error ?? "")}`);
  }
  return result.stdout;
}
