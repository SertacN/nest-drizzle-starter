import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import type { PaginationMeta } from 'shared';
import { DRIZZLE, type Database } from '../../core/db/drizzle.module';
import { examples, type ExampleRow } from '../../core/db/schema';
import { StorageService } from '../../core/storage/storage.service';
import type { CreateExampleDto, ListExamplesDto, UpdateExampleDto } from './dto';

/**
 * The ONLY layer that talks to the database for this module. Controllers never build queries
 * and other modules never reach past index.ts to get here.
 */
@Injectable()
export class ExampleService {
	constructor(
		@Inject(DRIZZLE) private readonly db: Database,
		private readonly storage: StorageService,
	) {}

	async list(userId: string, query: ListExamplesDto): Promise<{ items: ExampleRow[]; meta: PaginationMeta }> {
		// Ownership is part of every filter — a row is never reachable by id alone.
		const where = and(eq(examples.userId, userId), eq(examples.isDeleted, false), ...(query.status ? [eq(examples.status, query.status)] : []));

		const [items, [totals]] = await Promise.all([
			this.db.select().from(examples).where(where).orderBy(desc(examples.createdAt)).limit(query.perPage).offset(query.offset),
			this.db.select({ value: count() }).from(examples).where(where),
		]);

		const total = totals?.value ?? 0;
		return {
			items,
			meta: {
				total,
				page: query.page,
				perPage: query.perPage,
				totalPages: Math.ceil(total / query.perPage),
			},
		};
	}

	async get(userId: string, id: string): Promise<ExampleRow> {
		const [row] = await this.db
			.select()
			.from(examples)
			.where(and(eq(examples.id, id), eq(examples.userId, userId), eq(examples.isDeleted, false)))
			.limit(1);
		// 404 rather than 403 for someone else's row: the answer must not reveal that it exists.
		if (!row) throw new NotFoundException('example_not_found');
		return row;
	}

	async create(userId: string, dto: CreateExampleDto): Promise<ExampleRow> {
		const [row] = await this.db
			.insert(examples)
			.values({
				userId,
				title: dto.title,
				body: dto.body ?? null,
				status: dto.status ?? 'draft',
				imageUrl: dto.imageUrl ?? null,
			})
			.returning();
		return row;
	}

	async update(userId: string, id: string, dto: UpdateExampleDto): Promise<ExampleRow> {
		// Runs first so a foreign id fails with 404 before anything is written.
		const current = await this.get(userId, id);

		const [row] = await this.db
			.update(examples)
			.set({
				...(dto.title !== undefined ? { title: dto.title } : {}),
				...(dto.body !== undefined ? { body: dto.body } : {}),
				...(dto.status !== undefined ? { status: dto.status } : {}),
				...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
				updatedAt: new Date(),
			})
			.where(eq(examples.id, id))
			.returning();

		// The replaced file is now unreferenced. Deleting after the row is written means a
		// failed update never destroys the image that is still in use.
		if (dto.imageUrl !== undefined && current.imageUrl && current.imageUrl !== dto.imageUrl) {
			await this.storage.deleteFile(userId, current.imageUrl);
		}
		return row;
	}

	/**
	 * Soft delete rather than a real one: history and anything referencing this row survive.
	 * The uploaded image is a real file though, so it does get removed.
	 */
	async softDelete(userId: string, id: string): Promise<void> {
		const row = await this.get(userId, id);
		await this.db.update(examples).set({ isDeleted: true, updatedAt: new Date() }).where(eq(examples.id, id));
		await this.storage.deleteFile(userId, row.imageUrl);
	}

	/** Anonymous surface: published rows only, no owner filter, deliberately few columns. */
	listPublished() {
		return this.db
			.select({
				id: examples.id,
				title: examples.title,
				body: examples.body,
				imageUrl: examples.imageUrl,
				createdAt: examples.createdAt,
			})
			.from(examples)
			.where(and(eq(examples.status, 'published'), eq(examples.isDeleted, false)))
			.orderBy(desc(examples.createdAt))
			.limit(50);
	}
}
