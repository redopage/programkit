import type { EvaluationCriterion, EvaluationPlan, EvaluationRound, Id } from './types.ts'

export function evaluationRound(
  plan: EvaluationPlan | undefined,
  roundId: Id | undefined,
): EvaluationRound | undefined {
  if (!plan) return undefined
  return plan.rounds.find((round) => round.id === roundId) ?? plan.rounds[0]
}

export function evaluationRoundCriteria(
  plan: EvaluationPlan | undefined,
  roundId: Id | undefined,
): EvaluationCriterion[] {
  const round = evaluationRound(plan, roundId)
  return round?.criteria ?? plan?.criteria ?? []
}

export function evaluationRoundReviewerTeamId(
  plan: EvaluationPlan | undefined,
  roundId: Id | undefined,
): Id | undefined {
  const round = evaluationRound(plan, roundId)
  return round?.reviewerTeamId ?? plan?.reviewerTeamId
}

export function evaluationRoundIsBlind(
  plan: EvaluationPlan | undefined,
  roundId: Id | undefined,
): boolean {
  const round = evaluationRound(plan, roundId)
  return round?.blindReview ?? plan?.blindReview ?? false
}

export function evaluationCriterionKind(criterion: EvaluationCriterion) {
  return criterion.kind ?? 'numeric'
}
