import { createContext, useContext, type ReactNode } from 'react'

import { createProgramKitHttpClient } from './http.ts'
import type { ProgramKitClient } from './types.ts'

const defaultClient = createProgramKitHttpClient()
const ProgramKitClientContext = createContext<ProgramKitClient>(defaultClient)

export function ProgramKitClientProvider({
  client,
  children,
}: {
  client: ProgramKitClient
  children: ReactNode
}) {
  return (
    <ProgramKitClientContext.Provider value={client}>{children}</ProgramKitClientContext.Provider>
  )
}

export function useProgramKitClient() {
  return useContext(ProgramKitClientContext)
}
