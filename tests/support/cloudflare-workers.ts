export class DurableObject {
  constructor(_ctx: unknown, _env: unknown) {}
}

export class MemoryStorage {
  readonly values = new Map<string, unknown>()
  alarm: number | null = null

  async get<Value>(key: string) {
    return this.values.get(key) as Value | undefined
  }

  async put(key: string, value: unknown) {
    this.values.set(key, structuredClone(value))
  }

  async delete(key: string | string[]) {
    if (Array.isArray(key)) {
      for (const entry of key) this.values.delete(entry)
      return
    }
    this.values.delete(key)
  }

  async list<Value>({ prefix = '' }: { prefix?: string } = {}) {
    return new Map(
      [...this.values.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, structuredClone(value) as Value]),
    )
  }

  async transaction<Value>(callback: (storage: MemoryStorage) => Promise<Value>) {
    return callback(this)
  }

  async getAlarm() {
    return this.alarm
  }

  async setAlarm(value: number) {
    this.alarm = value
  }

  async deleteAlarm() {
    this.alarm = null
  }
}
