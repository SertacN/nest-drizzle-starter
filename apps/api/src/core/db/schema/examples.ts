import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { EXAMPLE_STATUSES } from 'shared';
import { users } from './users';

export const exampleStatus = pgEnum('example_status', EXAMPLE_STATUSES);

/** A complete, boring resource — copy this file and modules/example when adding a real one. */
export const examples = pgTable(
	'examples',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		body: text('body'),
		status: exampleStatus('status').notNull().default('draft'),
		imageUrl: text('image_url'),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	// Every list query filters by owner + is_active and sorts by created_at.
	(table) => [index('examples_user_id_created_at_idx').on(table.userId, table.createdAt)],
);

export type ExampleRow = typeof examples.$inferSelect;
