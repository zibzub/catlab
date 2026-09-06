import type { CSSProperties } from 'react'

export type CatLabIconName =
  | 'arrow-back-up'
  | 'arrow-forward-up'
  | 'box-multiple'
  | 'clipboard-text'
  | 'color-picker'
  | 'copy'
  | 'device-desktop'
  | 'device-floppy'
  | 'download'
  | 'external-link'
  | 'eye'
  | 'eye-off'
  | 'face'
  | 'flip-horizontal'
  | 'flip-vertical'
  | 'focus-2'
  | 'folder-open'
  | 'lock'
  | 'lock-open'
  | 'palette'
  | 'photo'
  | 'photo-edit'
  | 'pointer-2'
  | 'rectangle'
  | 'resize'
  | 'restore'
  | 'rotate'
  | 'text-size'
  | 'trash'
  | 'wallet'

interface CatLabIconProps {
  name: CatLabIconName
  size?: number
  className?: string
}

export function CatLabIcon({ name, size, className = '' }: CatLabIconProps) {
  const style = {
    ...(size === undefined ? {} : { width: size, height: size }),
    WebkitMaskImage: `url("/icons/${name}.svg")`,
    maskImage: `url("/icons/${name}.svg")`,
  } as CSSProperties

  return <span className={`catlab-icon${className ? ` ${className}` : ''}`} style={style} aria-hidden="true" />
}
