import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { STORED_IMAGE_EXTENSION } from 'shared';
import { StorageService } from '../../core/storage/storage.service';

/** Anything larger is downscaled — nobody needs a 6000px original on a web page. */
const MAX_DIMENSION = 1600;

@Injectable()
export class UploadService {
	constructor(private readonly storage: StorageService) {}

	/**
	 * Re-encodes an uploaded image to WebP and stores it under the user's scope.
	 *
	 * Re-encoding is not only about size: it strips EXIF (location data!) and guarantees the
	 * bytes on disk really are an image, whatever the client claimed the MIME type was.
	 */
	async storeImage(userId: string, file: Express.Multer.File): Promise<string> {
		let data: Buffer;
		try {
			data = await sharp(file.buffer)
				.rotate() // apply the EXIF orientation before it gets stripped
				.resize({
					width: MAX_DIMENSION,
					height: MAX_DIMENSION,
					fit: 'inside',
					withoutEnlargement: true,
				})
				.webp({ quality: 82 })
				.toBuffer();
		} catch {
			// sharp failed to decode it, so it was not an image no matter what the header said.
			throw new BadRequestException('invalid_image');
		}

		return this.storage.saveFile(userId, 'image', STORED_IMAGE_EXTENSION, data);
	}
}
