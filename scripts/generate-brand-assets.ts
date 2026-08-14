import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "apps", "mobile", "assets");
const brand = join(assets, "brand");

type OutputSpec = {
  input: string;
  output: string;
  width: number;
  height: number;
};

const outputs: OutputSpec[] = [
  { input: "wooriai-mark.svg", output: join(assets, "family-app-icon-master.png"), width: 1024, height: 1024 },
  { input: "wooriai-mark.svg", output: join(assets, "icon.png"), width: 1024, height: 1024 },
  { input: "wooriai-foreground.svg", output: join(assets, "adaptive-icon.png"), width: 1024, height: 1024 },
  { input: "wooriai-foreground.svg", output: join(assets, "splash-mark.png"), width: 512, height: 512 },
  { input: "wooriai-foreground.svg", output: join(assets, "illustrations", "logo_mark.png"), width: 256, height: 256 },
  { input: "wooriai-foreground.svg", output: join(assets, "illustrations", "growth_logo.png"), width: 256, height: 256 },
  { input: "wooriai-lockup.svg", output: join(assets, "illustrations", "logo_lockup.png"), width: 600, height: 160 },
  { input: "wooriai-monochrome.svg", output: join(assets, "monochrome-icon.png"), width: 432, height: 432 },
  { input: "wooriai-notification.svg", output: join(assets, "notification-icon.png"), width: 96, height: 96 }
];

async function main() {
  for (const output of outputs) {
    const source = readFileSync(join(brand, output.input));
    mkdirSync(dirname(output.output), { recursive: true });
    await sharp(source, { density: 384 })
      .resize(output.width, output.height, { fit: "contain" })
      .png({ compressionLevel: 9, palette: false })
      .toFile(output.output);
  }

  console.log(JSON.stringify({
    status: "GENERATED",
    outputs: outputs.map(({ output, width, height }) => ({ output, width, height }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
