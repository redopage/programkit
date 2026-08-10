import type { AirtableWorkspaceStore } from './airtable-store.ts'
import type { WorkspaceRepository } from './repository.ts'
import type { WorkspaceState } from './types.ts'

export class AirtableCachedWorkspaceRepository implements WorkspaceRepository {
  #mutationTail: Promise<void> = Promise.resolve()

  constructor(
    private readonly cache: WorkspaceRepository,
    private readonly airtable: Pick<AirtableWorkspaceStore, 'rebuildWorkspace' | 'writeDelta'>,
  ) {}

  read() {
    return this.cache.read()
  }

  async replaceCacheFromAirtable() {
    const restored = await this.airtable.rebuildWorkspace()
    await this.cache.mutate(() => ({ state: restored, result: undefined }))
    return restored
  }

  mutate<T>(mutation: (state: WorkspaceState) => { state: WorkspaceState; result: T }) {
    const run = this.#mutationTail.then(async () => {
      const current = await this.cache.read()
      const next = mutation(current)
      if (next.state !== current) {
        await this.airtable.writeDelta(current, next.state)
        await this.cache.mutate(() => ({ state: next.state, result: undefined }))
      }
      return next.result
    })
    this.#mutationTail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}
