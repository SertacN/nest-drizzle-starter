import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/**
 * ParseUUIDPipe with the error normalised to a stable CODE.
 *
 * The built-in one throws prose ('Validation failed (uuid is expected)'), which breaks the
 * rule that `error` in a response body is something a client can switch on. Use THIS one on
 * every `:id` param — route params reach a WHERE clause, so they are validated before they
 * get there.
 */
export const ParseUuid = new ParseUUIDPipe({
	version: '4',
	exceptionFactory: () => new BadRequestException('invalid_uuid'),
});
