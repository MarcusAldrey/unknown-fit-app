const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [...(config.watchFolders ?? []), monorepoRoot];

// Let Metro resolve packages from both project and monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Resolve the "@/" alias to src/ (mirrors tsconfig paths)
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@": path.resolve(projectRoot, "src"),
};

module.exports = config;
