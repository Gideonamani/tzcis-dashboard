import type { CSSProperties } from 'react'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  rounded?: boolean
  className?: string
  style?: CSSProperties
}

const Skeleton = ({
  width = '100%',
  height = '1rem',
  rounded = false,
  className = '',
  style,
}: SkeletonProps) => {
  const mergedStyle: CSSProperties = {
    width,
    height,
    ...style,
  }

  const classes = ['skeleton', rounded ? 'skeleton--rounded' : '', className]
    .filter(Boolean)
    .join(' ')

  return <span className={classes} style={mergedStyle} aria-hidden="true" />
}

export default Skeleton
