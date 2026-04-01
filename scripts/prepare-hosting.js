const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const deployDir = path.join(repoRoot, "deploy");

const filesToCopy = ["index.html", "app.js", "styles.css", ".nojekyll"];
const directoriesToCopy = ["data"];

fs.rmSync(deployDir, { recursive: true, force: true });
fs.mkdirSync(deployDir, { recursive: true });

for (const relativePath of filesToCopy) {
  const sourcePath = path.join(repoRoot, relativePath);
  const destinationPath = path.join(deployDir, relativePath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Required file not found: ${relativePath}`);
  }
  fs.copyFileSync(sourcePath, destinationPath);
}

for (const relativePath of directoriesToCopy) {
  const sourcePath = path.join(repoRoot, relativePath);
  const destinationPath = path.join(deployDir, relativePath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Required directory not found: ${relativePath}`);
  }
  fs.cpSync(sourcePath, destinationPath, { recursive: true });
}

console.log(`Prepared Firebase Hosting directory at ${deployDir}`);
