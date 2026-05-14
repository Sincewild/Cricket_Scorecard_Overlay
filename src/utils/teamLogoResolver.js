const fs = require('fs');
const path = require('path');

function normalizeTeamName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

function createTeamLogoResolver(options) {
  const logosDir = options.logosDir;

  // Explicit aliases for known teams.
  const aliasMap = {
    'jerseylions': 'JerseyLions.png',
    'usaca': 'USACA.png'
  };

  let files = [];
  try {
    files = fs.readdirSync(logosDir)
      .filter((name) => /\.(png|jpg|jpeg|webp|svg)$/i.test(name));
  } catch (_) {
    files = [];
  }

  const normalizedFileMap = new Map();
  for (const fileName of files) {
    const baseName = fileName.replace(/\.[^.]+$/, '');
    normalizedFileMap.set(normalizeTeamName(baseName), fileName);
  }

  function resolveTeamLogoPath(teamName) {
    const normalized = normalizeTeamName(teamName);
    if (!normalized) return null;

    const aliasFile = aliasMap[normalized];
    if (aliasFile) return `/logos/${encodeURIComponent(aliasFile)}`;

    const matchedFile = normalizedFileMap.get(normalized);
    if (matchedFile) return `/logos/${encodeURIComponent(matchedFile)}`;

    return null;
  }

  return {
    resolveTeamLogoPath
  };
}

module.exports = {
  createTeamLogoResolver,
  normalizeTeamName
};