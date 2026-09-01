export function validateMoonCatNamesArtifact(value, { expectedCount = 25_440 } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('MoonCat names artifact must be an object')
  }

  for (const [key, entry] of Object.entries(value)) {
    if (!/^\d+$/.test(key)) {
      throw new Error(`MoonCat names artifact has an invalid rescue order key: ${key}`)
    }
    const rescueOrder = Number(key)
    if (!Number.isInteger(rescueOrder) || String(rescueOrder) !== key || rescueOrder < 0 || rescueOrder >= expectedCount) {
      throw new Error(`MoonCat names artifact rescue order is out of range: ${key}`)
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.name !== 'string' || entry.name.length === 0) {
      throw new Error(`MoonCat names artifact entry ${key} needs a non-empty string name`)
    }
    if (entry.timestamp !== null && (
      typeof entry.timestamp !== 'number' || !Number.isFinite(entry.timestamp) || entry.timestamp < 0
    )) {
      throw new Error(`MoonCat names artifact entry ${key} has an invalid timestamp`)
    }
  }

  return value
}
