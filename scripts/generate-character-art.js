#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const characters = require("../data/characters.js");

const projectRoot = path.resolve(__dirname, "..");
const imageApiUrl = "https://api.openai.com/v1/images/generations";

function parseArgs(argv) {
  const args = { dryRun: false, all: false, id: "", overwrite: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.dryRun = true;
    if (arg === "--all") args.all = true;
    if (arg === "--overwrite") args.overwrite = true;
    if (arg === "--id") {
      args.id = argv[index + 1] || "";
      index += 1;
    }
  }
  return args;
}

function resolveTargetPath(character) {
  const relativePath = character.image.replace(/^\.\//, "");
  return path.resolve(projectRoot, relativePath);
}

function getOutputFormat(character) {
  const extension = path.extname(resolveTargetPath(character)).toLowerCase();
  if (extension === ".png") return "png";
  if (extension === ".jpg" || extension === ".jpeg") return "jpeg";
  if (extension === ".webp") return "webp";
  throw new Error(`Unsupported image extension for ${character.id}: ${extension}`);
}

function selectCharacters(args) {
  if (args.all) return characters;
  if (args.id) {
    const character = characters.find((item) => item.id === args.id);
    if (!character) {
      throw new Error(`Unknown character id: ${args.id}`);
    }
    return [character];
  }
  throw new Error("Choose characters with --all or --id <character-id>.");
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

function printDryRun(character) {
  const targetPath = resolveTargetPath(character);
  console.log(`--- ${character.id} | ${character.name} ---`);
  console.log(`target: ${path.relative(projectRoot, targetPath)}`);
  console.log(character.prompt);
  console.log("");
}

async function requestImage(character, apiKey) {
  const outputFormat = getOutputFormat(character);
  const body = {
    model: "gpt-image-2",
    prompt: character.prompt,
    size: "1024x1536",
    quality: "high",
    output_format: outputFormat,
    background: "opaque"
  };
  if (outputFormat !== "png") {
    body.output_compression = 90;
  }

  const response = await fetch(imageApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Image API failed for ${character.id}: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const imageBase64 = payload.data && payload.data[0] && (payload.data[0].b64_json || payload.data[0].image_base64);
  if (!imageBase64) {
    throw new Error(`Image API response for ${character.id} did not include base64 image data.`);
  }
  return Buffer.from(imageBase64, "base64");
}

async function writeImage(character, imageBuffer) {
  const targetPath = resolveTargetPath(character);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await fs.writeFile(tmpPath, imageBuffer);
    await fs.rename(tmpPath, targetPath);
  } catch (error) {
    await fs.rm(tmpPath, { force: true });
    throw error;
  }
}

async function generateCharacter(character, args, apiKey) {
  const targetPath = resolveTargetPath(character);
  if (!args.overwrite && await fileExists(targetPath)) {
    console.log(`skip existing: ${character.id} -> ${path.relative(projectRoot, targetPath)}`);
    return;
  }

  console.log(`generating: ${character.id} -> ${path.relative(projectRoot, targetPath)}`);
  const imageBuffer = await requestImage(character, apiKey);
  await writeImage(character, imageBuffer);
  console.log(`wrote: ${path.relative(projectRoot, targetPath)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selected = selectCharacters(args);

  if (args.dryRun) {
    selected.forEach(printDryRun);
    console.log(`dry-run prompts: ${selected.length}`);
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required unless you use --dry-run.");
  }

  for (const character of selected) {
    try {
      await generateCharacter(character, args, apiKey);
    } catch (error) {
      console.error(error.message);
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  getOutputFormat,
  parseArgs,
  resolveTargetPath,
  selectCharacters
};
