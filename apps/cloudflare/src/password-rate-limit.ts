export const passwordFailureRateWindowMs = 60 * 60 * 1_000

export const defaultPasswordFailureRateLimits = {
  email: 10,
  ip: 40,
} as const

interface PasswordFailureRateLimitEnv {
  PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_EMAIL?: string | number
  PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_IP?: string | number
}

export interface PasswordFailureRateLimits {
  email: number
  ip: number
}

function limit(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 1_000 ? parsed : fallback
}

export function passwordFailureRateLimits(
  env: PasswordFailureRateLimitEnv,
): PasswordFailureRateLimits {
  return {
    email: limit(
      env.PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_EMAIL,
      defaultPasswordFailureRateLimits.email,
    ),
    ip: limit(env.PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_IP, defaultPasswordFailureRateLimits.ip),
  }
}
