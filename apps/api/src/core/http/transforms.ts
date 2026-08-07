import type { TransformFnParams } from 'class-transformer';

/**
 * The normalisations DTOs apply before validation runs.
 *
 * They live here rather than inline in every DTO for two reasons: the same rule must not be
 * written twice (a trimmed email in one place and an untrimmed one in another is a real bug),
 * and `value` is `any` inside class-transformer, so narrowing it once keeps that `any` from
 * spreading into every DTO file.
 *
 * Non-strings pass through untouched — rejecting them is class-validator's job, not this one's.
 */
export const trim = ({ value }: TransformFnParams): unknown =>
	typeof value === 'string' ? value.trim() : value;

/** For emails: the uniqueness check and the stored value must agree on case. */
export const trimLowercase = ({ value }: TransformFnParams): unknown =>
	typeof value === 'string' ? value.trim().toLowerCase() : value;
