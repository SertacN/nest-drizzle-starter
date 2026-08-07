// A complete, boring resource. Copy this file (and modules/example) when adding a real one.

export const EXAMPLE_STATUSES = ["draft", "published", "archived"] as const;
export type ExampleStatus = (typeof EXAMPLE_STATUSES)[number];
