import fs from "node:fs/promises";
import { basename, dirname, resolve, relative, join } from "node:path";
import AdmZip from "adm-zip";
import { build } from "esbuild";
import htmlPlugin from "@chialab/esbuild-plugin-html";
import sharp from "sharp";
import watch from "node-watch";
import { sassPlugin } from "esbuild-sass-plugin";

async function buildAssets(label, srcdir, resdir) {
  label = `${label}[assets]`;
  console.time(label);

  await fs.mkdir(resolve(resdir, "pages/assets"), { recursive: true });

  for (const variant of ["light", "dark"]) {
    const src = resolve(srcdir, `pages/assets/icon-${variant}.svg`);
    for (const size of [16, 32, 48, 196]) {
      const output = resolve(
        resdir,
        `pages/assets/icon-${variant}-${size}x${size}.png`
      );
      await sharp(src).resize(size, size).toFile(output);
    }

    // Apple default icon
    if (variant === "light") {
      await Promise.all([
        sharp(src)
          .resize(137, 137)
          .extend({
            top: 15,
            left: 15,
            bottom: 15,
            right: 15,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .toFile(resolve(resdir, `pages/assets/apple-touch-icon-ipad.png`)),
        sharp(src)
          .resize(150, 150)
          .extend({
            top: 15,
            left: 15,
            bottom: 15,
            right: 15,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .toFile(resolve(resdir, `pages/assets/apple-touch-icon.png`)),
      ]);
    }
  }

  await fs
    .readdir(resolve(srcdir, "pages/assets"), {
      recursive: true,
      withFileTypes: true,
    })
    .then((entries) => {
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => {
          return relative(srcdir, join(entry.parentPath, entry.name));
        });
    })
    .then(async (entries) => {
      for (const entry of entries) {
        await fs.mkdir(resolve(resdir, dirname(entry)), { recursive: true });
        await fs.copyFile(resolve(srcdir, entry), resolve(resdir, entry));
      }
    });

  console.timeEnd(label);
}

/**
 * Creates the files `manifests/chromium.json` and `manifests/firefox.json`
 * into `outdir`, by reading the files `manifests/common.json`,
 * `manifests/chromium.json` and `manifests/firefox.json` from `srcdir`.
 *
 * The variables `#name#`, `#description#` and `#version#` are replaced by the
 * values from `package.json`.
 *
 * @param {string} label
 * @param {object} pkg
 * @param {string} srcdir
 * @param {string} resdir
 */
async function buildManifests(label, pkg, srcdir, resdir) {
  label = `${label}[manifests]`;
  console.time(label);

  const toTitleCase = function (str) {
    return str.replace(
      /\w\S*/g,
      (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
  };

  const replaceByPackage = function (obj) {
    for (const key in obj) {
      const value = obj[key];

      if (typeof value == "object" && value !== null) {
        obj[key] = replaceByPackage(value);
        continue;
      }

      if (!(typeof value === "string" || value instanceof String)) {
        continue;
      }

      obj[key] = value
        .replaceAll("#name#", toTitleCase(pkg.name))
        .replaceAll("#description#", pkg.description)
        .replaceAll("#version#", pkg.version);
    }
    return obj;
  };

  const srcCommon = resolve(srcdir, `manifests/common.json`);
  const srcChromium = resolve(srcdir, `manifests/chromium.json`);
  const srcFirefox = resolve(srcdir, `manifests/firefox.json`);
  const outChromium = resolve(resdir, `manifests/chromium.json`);
  const outFirefox = resolve(resdir, `manifests/firefox.json`);

  const [jsonCommon, jsonChromium, jsonFirefox] = await Promise.all([
    fs
      .readFile(srcCommon)
      .then((content) => JSON.parse(content))
      .then((content) => replaceByPackage(content)),
    fs
      .readFile(srcChromium)
      .then((content) => JSON.parse(content))
      .then((content) => replaceByPackage(content)),
    fs
      .readFile(srcFirefox)
      .then((content) => JSON.parse(content))
      .then((content) => replaceByPackage(content)),
  ]);

  await Promise.all([
    fs.mkdir(dirname(outChromium), { recursive: true }),
    fs.mkdir(dirname(outFirefox), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(
      outChromium,
      JSON.stringify({ ...jsonCommon, ...jsonChromium }, null, 2)
    ),
    fs.writeFile(
      outFirefox,
      JSON.stringify({ ...jsonCommon, ...jsonFirefox }, null, 2)
    ),
  ]);

  console.timeEnd(label);
}

/**
 * @param {string} label
 * @param {boolean} dev
 * @param {string} srcdir
 * @param {string} resdir
 */
async function buildPages(label, dev, srcdir, resdir) {
  label = `${label}[pages]`;
  console.time(label);

  const outdir = resolve(resdir, "pages/");
  const entryPoints = ["pages/options.html", "pages/popup.html"].map((e) =>
    resolve(srcdir, e)
  );

  const result = await Promise.all([
    build({
      entryPoints: [resolve(srcdir, "pages/background.js")],
      bundle: true,
      sourcemap: dev ? "inline" : false,
      outdir: outdir,
      minify: dev ? false : true,
      assetNames: "assets/[name]-[hash]",
      chunkNames: "[ext]/[name]-[hash]",
      entryNames: "[name]",
      treeShaking: true,
    }),
    build({
      entryPoints: entryPoints,
      bundle: true,
      sourcemap: dev ? "inline" : false,
      splitting: true,
      format: "esm",
      loader: { ".png": "file", ".woff": "file", ".woff2": "file" },
      outdir: outdir,
      minify: dev ? false : true,
      assetNames: "assets/[name]-[hash]",
      chunkNames: "[ext]/[name]-[hash]",
      entryNames: "[name]",
      treeShaking: true,
      plugins: [htmlPlugin({ generateIcons: false }), sassPlugin()],
    }),
  ]);

  console.timeEnd(label);
  return result;
}

/**
 * @param {string} label
 * @param {object} pkg
 * @param {boolean} dev
 * @param {string} srcdir
 * @param {string} resdir
 */
async function buildResources(label, pkg, dev, srcdir, resdir) {
  label = `${label}[resources]`;
  console.time(label);

  await fs.mkdir(resdir, { recursive: true });
  await Promise.all([
    buildAssets(label, srcdir, resdir),
    buildManifests(label, pkg, srcdir, resdir),
    buildPages(label, dev, srcdir, resdir),
  ]);

  console.timeEnd(label);
}

/**
 * @param {string} label
 * @param {object} pkg
 * @param {string} resdir
 * @param {string} outdir
 */
async function buildPack(label, pkg, resdir, outdir) {
  label = `${label}[pack]`;
  console.time(label);

  const filesCommon = {
    files: await fs
      .readdir(resolve(resdir, "pages"), {
        recursive: true,
        withFileTypes: true,
      })
      .then((entries) => {
        return entries
          .filter((entry) => entry.isFile())
          .map((entry) => {
            const f = relative(resdir, join(entry.parentPath, entry.name));
            return { src: f, dst: f };
          });
      }),
  };

  const packFor = async function (label, name, output, files) {
    label = `${label}[${name}]{${basename(output)}}`;
    console.time(label);

    const copyResourcesIntoTemporalDirectory = async function (
      label,
      tdir,
      files
    ) {
      console.time(label);

      for (const file of files) {
        const src = resolve(resdir, file.src);
        const dst = resolve(tdir, file.dst);
        await fs.mkdir(dirname(dst), { recursive: true });
        await fs.copyFile(src, dst);
      }

      console.timeEnd(label);
    };

    const compressDirectory = async function (label, filename, directory) {
      console.time(label);

      const zip = new AdmZip();
      zip.addLocalFolder(directory);
      zip.writeZip(filename);

      console.timeEnd(label);
    };

    const decompressDir = resolve(dirname(output), name);
    await fs.mkdir(decompressDir, {
      recursive: true,
    });
    await copyResourcesIntoTemporalDirectory(
      `${label}[cp_resources]`,
      decompressDir,
      files
    );
    await compressDirectory(
      `${label}[compress]{${decompressDir}}`,
      output,
      decompressDir
    );

    console.timeEnd(label);
  };

  await Promise.all([
    packFor(
      label,
      "chromium",
      resolve(outdir, `${pkg.name}.${pkg.version.replaceAll(".", "_")}.crx`),
      [
        ...filesCommon.files,
        { src: "manifests/chromium.json", dst: "manifest.json" },
      ]
    ),
    packFor(
      label,
      "firefox",
      resolve(outdir, `${pkg.name}.${pkg.version.replaceAll(".", "_")}.xpi`),
      [
        ...filesCommon.files,
        { src: "manifests/firefox.json", dst: "manifest.json" },
      ]
    ),
  ]);

  console.timeEnd(label);
}

async function cleanDist(label, resources) {
  label = `${label}[clean]`;
  console.time(label);

  try {
    await fs.rm(resources, { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  console.timeEnd(label);
}

async function buildExtensions(dev) {
  const label = "[build]";
  console.time(label);

  const srcdir = resolve(import.meta.dirname, "..");
  const outdir = resolve(import.meta.dirname, "../../dist");
  const resources = resolve(outdir, "resources");

  const pkg = await fs
    .readFile(resolve(import.meta.dirname, "../../package.json"))
    .then((content) => JSON.parse(content));

  try {
    await cleanDist(label, outdir);
    await buildResources(label, pkg, dev, srcdir, resources);
    await buildPack(label, pkg, resources, outdir);
  } catch (err) {
    console.error(err);
  }

  console.timeEnd(label);
}

async function watchExtensions(dev) {
  const label = "[watch]";
  console.time(label);

  const srcdir = resolve(import.meta.dirname, "..");
  const outdir = resolve(import.meta.dirname, "../../dist");
  const resources = resolve(outdir, "resources");

  const pkg = await fs
    .readFile(resolve(import.meta.dirname, "../../package.json"))
    .then((content) => JSON.parse(content));

  await buildExtensions(dev);
  watch(srcdir, { recursive: true }, async (evt, name) => {
    await buildExtensions(dev);
  });

  console.timeEnd(label);
}

function showHelp() {
  console.log(`Usage:
\t${process.argv[0]} ${process.argv[1]} <command> [flags]

Commands:
\tbuild\tCreate browser extension packs.
\twatch\tContinously build on each detected changes.

Flags:
\t--dev\t-d\tGenerate sourceMaps and disable minification.`);
}

async function main() {
  let argDev = false;
  let argBuild = false;
  let arhWatch = false;
  let argHelp = false;

  for (const arg of process.argv.slice(2)) {
    switch (arg) {
      case "--help":
      case "-h":
        argHelp = true;
        break;
      case "--dev":
      case "-d":
        argDev = true;
        break;
      case "build":
        argBuild = true;
        break;
      case "watch":
        arhWatch = true;
        break;
    }
  }

  if (argHelp) {
    showHelp();
  } else if (argBuild) {
    await buildExtensions(argDev);
  } else if (arhWatch) {
    await watchExtensions(argDev);
  } else {
    showHelp();
  }
}

await main();
