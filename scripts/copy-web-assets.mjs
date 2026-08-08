import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('../packages/web', import.meta.url))
await mkdir(resolve(packageRoot, 'dist'), { recursive: true })
await copyFile(resolve(packageRoot, 'src/styles.css'), resolve(packageRoot, 'dist/styles.css'))
