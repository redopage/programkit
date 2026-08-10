import { createFileRoute } from '@tanstack/react-router'

import { FilesView } from '../views/FilesView.tsx'

export const Route = createFileRoute('/_operator/files')({ component: FilesView })
