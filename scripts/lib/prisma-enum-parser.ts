export function parsePrismaEnum(schema: string, enumName: string): string[] {
  const match = schema.match(new RegExp(`enum\\s+${enumName}\\s*\\{([\\s\\S]*?)\\}`));
  if (!match) return [];
  return match[1]!
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("@@") && !line.startsWith("@"))
    .map((line) => line.split(/\s+/)[0]!);
}
