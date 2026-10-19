import * as esbuild from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const watch = process.argv.includes("--watch");
mkdirSync("dist", { recursive: true });

const common = { bundle: true, target: "es2017", logLevel: "warning", legalComments: "none" };

async function buildUi() {
  const res = await esbuild.build({
    ...common,
    entryPoints: ["src/ui/main.tsx"],
    write: false,
    format: "iife",
    minify: !watch,
    jsx: "automatic",
    jsxImportSource: "preact",
  });
  const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
  const css = readFileSync("src/ui/styles.css", "utf8");
  writeFileSync("dist/ui.html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="app"></div><script>${js}</script></body></html>`);
}

const mainOpts = { ...common, entryPoints: ["src/plugin/main.ts"], outfile: "dist/code.js", format: "iife", minify: !watch };

if (watch) {
  const ctx = await esbuild.context({
    ...mainOpts,
    plugins: [{ name: "ui", setup(b) { b.onEnd(() => buildUi().then(() => console.log("rebuilt", new Date().toLocaleTimeString()))); } }],
  });
  await ctx.watch();
  console.log("Watching for changes… (Ctrl+C to quit)");
} else if (process.argv.includes("--harness")) {
  await buildUi();
  const sim = await esbuild.build({ ...common, entryPoints: ["tests/harness/sim.ts"], write: false, format: "iife" });
  const html = readFileSync("dist/ui.html", "utf8").replace("<body>", `<body><script>${sim.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script>`);
  writeFileSync("dist/harness.html", html);
  console.log("Open dist/harness.html in a browser");
} else {
  await esbuild.build(mainOpts);
  await buildUi();
  console.log("dist/code.js and dist/ui.html ready");
}
