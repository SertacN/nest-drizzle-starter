// The role list is declared here because BOTH ends need it: the API builds its pgEnum and its
// class-validator rules from it, the frontend renders it. One source, no drift.
export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Password bounds live here too — the browser can reject a too-short password before spending
// a round trip, and the API enforces exactly the same numbers.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

/** Cookie names the API sets. A frontend never reads them (httpOnly) but tests and the
 *  WebSocket handshake do. */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
