import type { ExampleStatus } from "../constants/example";
import type { PaginationQuery } from "./api";

export interface Example {
    id: string;
    userId: string;
    title: string;
    body: string | null;
    status: ExampleStatus;
    imageUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ExampleCreateInput {
    title: string;
    body?: string;
    status?: ExampleStatus;
    imageUrl?: string;
}

/** Every field optional, but at least one must be present — an empty PATCH is a client bug. */
export interface ExampleUpdateInput {
    title?: string;
    body?: string;
    status?: ExampleStatus;
    imageUrl?: string | null;
}

export interface ExampleListQuery extends PaginationQuery {
    status?: ExampleStatus;
}

/** The trimmed row the anonymous endpoint returns — deliberately smaller than `Example`. */
export interface PublicExample {
    id: string;
    title: string;
    body: string | null;
    imageUrl: string | null;
    createdAt: string;
}
