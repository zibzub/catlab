interface EyeDropperLike {
  open: () => Promise<{ sRGBHex: string }>
}

interface EyeDropperConstructor {
  new (): EyeDropperLike
}

interface EyeDropperWindow {
  EyeDropper?: EyeDropperConstructor
}

export type ColorPickResult =
  | { status: 'picked'; color: string }
  | { status: 'cancelled' }
  | { status: 'unsupported' }

function eyeDropperConstructor() {
  if (typeof window === 'undefined') return null
  return (window as Window & EyeDropperWindow).EyeDropper ?? null
}

export function supportsColorPicker() {
  return eyeDropperConstructor() !== null
}

export function normalizeCssHex(value: string) {
  const normalized = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized
  if (/^#[0-9a-f]{3}$/.test(normalized)) {
    return `#${normalized.slice(1).split('').map((digit) => `${digit}${digit}`).join('')}`
  }
  return null
}

export async function requestScreenColor(): Promise<ColorPickResult> {
  const Constructor = eyeDropperConstructor()
  if (!Constructor) return { status: 'unsupported' }

  try {
    const result = await new Constructor().open()
    const color = normalizeCssHex(result.sRGBHex)
    return color ? { status: 'picked', color } : { status: 'cancelled' }
  } catch {
    return { status: 'cancelled' }
  }
}
