import { createFileRoute } from '@tanstack/react-router'

import { useProgramNavigate } from '../lib/navigation.ts'
import { FormsView } from '../views/FormsView.tsx'

export const Route = createFileRoute('/_operator/forms')({
  validateSearch: (search: Record<string, unknown>) => ({
    form: typeof search.form === 'string' ? search.form : undefined,
    field: typeof search.field === 'string' ? search.field : undefined,
  }),
  component: FormsRoute,
})

function FormsRoute() {
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()
  return (
    <FormsView
      navigate={useProgramNavigate()}
      selectedFormId={search.form}
      selectedFieldId={search.field}
      onSelectionChange={(form, field) =>
        void routeNavigate({ search: { form, field }, replace: true })
      }
    />
  )
}
