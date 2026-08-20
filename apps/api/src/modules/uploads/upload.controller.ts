import { BadRequestException, Controller, HttpCode, HttpStatus, ParseFilePipeBuilder, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, type UploadResult } from 'shared';
import { GetUser } from '../../core/http/decorators';
import type { ServiceResponse } from '../../core/http/types';
import { JwtGuard } from '../auth';
import { UploadService } from './upload.service';

@ApiTags('Uploads')
@ApiCookieAuth()
@UseGuards(JwtGuard)
@Controller('uploads')
export class UploadController {
	constructor(private readonly uploadService: UploadService) {}

	/**
	 * The returned URL is not tied to any row yet — whoever uploads is responsible for saving it
	 * into a column. Files that never get referenced stay on disk; add a sweeper job if that
	 * becomes a problem.
	 */
	@Post('image')
	@HttpCode(HttpStatus.CREATED)
	// Megabytes plus sharp CPU time per call: the global default is far too generous here.
	@Throttle({ default: { limit: 60, ttl: 15 * 60_000 } })
	@UseInterceptors(
		// Kept in memory: sharp re-encodes the bytes anyway, so the raw upload never touches disk.
		FileInterceptor('file', {
			limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 },
		}),
	)
	@ApiConsumes('multipart/form-data')
	@ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
	@ApiOperation({ summary: 'Upload an image; it is re-encoded to WebP and stored' })
	async uploadImage(
		@GetUser('id') userId: string,
		@UploadedFile(
			new ParseFilePipeBuilder()
				// The declared MIME type is only a hint — the real guarantee is that sharp has
				// to be able to decode the bytes. This just rejects the obvious cases early.
				.addFileTypeValidator({ fileType: new RegExp(ACCEPTED_IMAGE_TYPES.join('|')) })
				.addMaxSizeValidator({ maxSize: MAX_UPLOAD_BYTES })
				.build({ fileIsRequired: false }),
		)
		file: Express.Multer.File | undefined,
	): Promise<ServiceResponse<UploadResult>> {
		if (!file) throw new BadRequestException('file_required');
		return {
			message: 'Image uploaded',
			data: { url: await this.uploadService.storeImage(userId, file) },
		};
	}
}
