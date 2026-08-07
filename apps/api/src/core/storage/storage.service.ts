import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Public path prefix these files are served under (see StorageModule). */
export const UPLOADS_URL_PREFIX = '/api/uploads';

/** The only names we generate: `<prefix>-<24 hex>.<ext>`. Reads and deletes verify it. */
const FILE_NAME_PATTERN = /^[a-z]+-[0-9a-f]{24}\.[a-z0-9]+$/;

/**
 * The ONLY code that touches the disk. Moving to object storage (S3/R2) means rewriting this
 * class and nothing else — callers only ever see a URL.
 *
 * Files are grouped by `scope`, a caller-chosen directory name (here: the owner's user id).
 * Every read/delete re-derives the path from the scope, so a forged URL cannot reach another
 * scope's files.
 */
@Injectable()
export class StorageService {
	private readonly logger = new Logger(StorageService.name);

	constructor(private readonly config: ConfigService) {}

	/** Root for the static file server. */
	get root(): string {
		return this.config.getOrThrow<string>('UPLOAD_DIR');
	}

	/**
	 * Writes data into the scope's directory under a unique name and returns its public URL.
	 * The name changes on every upload, which is what makes the files safe to cache immutably.
	 */
	async saveFile(scope: string, prefix: string, extension: string, data: Buffer): Promise<string> {
		const dir = join(this.root, scope);
		await mkdir(dir, { recursive: true });
		const fileName = `${prefix}-${randomBytes(12).toString('hex')}.${extension}`;
		await writeFile(join(dir, fileName), data);
		return `${UPLOADS_URL_PREFIX}/${scope}/${fileName}`;
	}

	/** Reads a stored file back. Returns null for a URL that does not belong to this scope. */
	async readFile(scope: string, url: string): Promise<Buffer | null> {
		const fileName = this.resolveFileName(scope, url);
		if (!fileName) return null;
		try {
			return await readFile(join(this.root, scope, fileName));
		} catch {
			return null;
		}
	}

	/**
	 * Deletes the old file when a column moves to a new value. Silently does nothing if the URL
	 * is not one of this scope's files (an external URL, another scope's path, a made-up name),
	 * so callers do not have to validate first. A failed delete never fails the request: the
	 * file is unreferenced either way, at worst it wastes disk.
	 */
	async deleteFile(scope: string, url: string | null | undefined): Promise<void> {
		const fileName = url ? this.resolveFileName(scope, url) : null;
		if (!fileName) return;
		try {
			await rm(join(this.root, scope, fileName), { force: true });
		} catch (err) {
			this.logger.warn(`could not delete file: ${url}`, err);
		}
	}

	private resolveFileName(scope: string, url: string): string | null {
		const expectedPrefix = `${UPLOADS_URL_PREFIX}/${scope}/`;
		if (!url.startsWith(expectedPrefix)) return null;
		const fileName = url.slice(expectedPrefix.length);
		return FILE_NAME_PATTERN.test(fileName) ? fileName : null;
	}
}
