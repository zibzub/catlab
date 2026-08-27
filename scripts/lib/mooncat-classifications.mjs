export const CLASSIFICATION_CATEGORY_KEYS = [
  'sub100',
  'day1',
  'week1',
  'earlyRescues',
  'garfield',
  'cheshire',
  'pinkpanther',
  'alien',
  'zombie',
  'simba',
  'golden',
  'pikachu',
]

export function validateClassificationArtifact(value, { expectedCount = 25_440 } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('MoonCat classification artifact must be an object')
  }
  if (value.schemaVersion !== 1) {
    throw new Error('MoonCat classification artifact schemaVersion must be 1')
  }
  if (value.count !== expectedCount || value.maxId !== expectedCount - 1) {
    throw new Error(`MoonCat classification artifact must cover ${expectedCount} rescue orders`)
  }
  if (!value.categories || typeof value.categories !== 'object' || Array.isArray(value.categories)) {
    throw new Error('MoonCat classification artifact is missing categories')
  }

  for (const key of CLASSIFICATION_CATEGORY_KEYS) {
    const category = value.categories[key]
    if (!category || typeof category !== 'object' || Array.isArray(category)) {
      throw new Error(`MoonCat classification artifact is missing categories.${key}`)
    }
    if (typeof category.label !== 'string' || typeof category.group !== 'string') {
      throw new Error(`MoonCat classification artifact categories.${key} needs label and group metadata`)
    }
    if (!Array.isArray(category.ids) || category.ids.length === 0) {
      throw new Error(`MoonCat classification artifact categories.${key}.ids must be a non-empty array`)
    }
    let previous = -1
    for (const id of category.ids) {
      if (!Number.isInteger(id) || id < 0 || id >= expectedCount || id <= previous) {
        throw new Error(`MoonCat classification artifact categories.${key}.ids must be sorted unique rescue orders`)
      }
      previous = id
    }
  }

  return value
}
