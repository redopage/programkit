import { createSeedState } from './seed.ts'
import type { WorkspaceState } from './types.ts'
import { cloneState } from './utils.ts'

export interface WorkspaceRepository {
  read(): Promise<WorkspaceState>
  mutate<T>(mutation: (state: WorkspaceState) => { state: WorkspaceState; result: T }): Promise<T>
}

export class MemoryWorkspaceRepository implements WorkspaceRepository {
  #state: WorkspaceState
  #mutationTail: Promise<void> = Promise.resolve()

  constructor(initialState: WorkspaceState = createSeedState()) {
    this.#state = cloneState(initialState)
  }

  async read() {
    await this.#mutationTail
    return cloneState(this.#state)
  }

  mutate<T>(mutation: (state: WorkspaceState) => { state: WorkspaceState; result: T }) {
    const run = this.#mutationTail.then(() => {
      const current = cloneState(this.#state)
      const next = mutation(current)
      if (next.state !== current) this.#state = cloneState(next.state)
      return next.result
    })
    this.#mutationTail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}
