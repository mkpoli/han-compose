export type RenderNode = string | RenderArray;
export type RenderArray = Array<string | RenderArray>;
export type RecordEvidence = {
    e?: string;
    s?: string;
};
export type ParsedEvidence = {
    node: RenderNode | null;
    capped: boolean;
};
export type Limits = {
    records?: number;
    nodes?: number;
    depth?: number;
    work?: number;
};
export type RenderPlan = {
    /**
     * The original description, including its operator annotations.
     */
    source: string;
    /**
     * The resolved rendering key.
     */
    key: string;
    /**
     * The contracted rendering tree; unsuccessful expansions never replace it.
     */
    node: RenderNode;
    /**
     * The whole-node character proved by an export's e field.
     */
    encoded: string | null;
    /**
     * Plans for the original children, in source order.
     */
    children: readonly RenderPlan[];
    /**
     * Whether a limit prevented further resolution.
     */
    capped: boolean;
};
/**
 * Build a synchronous normalizer over one composer's export records. Positive records are shared
 * across calls; nulls are cached only within a call because their shards may still be loading.
 * The record callback owns that signal. Discard provisional plans while the store reports missing shards.
 *
 * The input is an already parsed composer tree. parse and keyOf must round-trip its modifiers,
 * variation selectors and marks. Only explicit e mappings contract a node. Source atoms resolve
 * through their own e mappings only. Compound evidence search may expand operands through s and
 * contract those descriptions, so an expanded operand can match beside a contracted one.
 *
 * records bounds record callbacks across the normalizer's lifetime (one composer/load pass).
 * nodes counts source and candidate tree visits; depth bounds nesting and rewrite distance; work
 * bounds resolution/search steps. These three budgets reset per resolve call and cover every source
 * child. A capped plan retains proven contractions; its last proved target may still have unread
 * outgoing e evidence. The caller can memoize plans for its load pass.
 *
 * @param {{ record: (key: string) => RecordEvidence | null | undefined,
 *   parse: (text: string) => RenderNode, keyOf: (node: RenderNode) => string,
 *   excluded?: (key: string) => boolean, limits?: Limits }} options
 * @returns {{ resolve: (node: RenderNode) => RenderPlan }}
 */
export declare function createRenderNormalizer({ record, parse, keyOf, excluded, limits }: {
    record: (key: string) => RecordEvidence | null | undefined;
    parse: (text: string) => RenderNode;
    keyOf: (node: RenderNode) => string;
    excluded?: (key: string) => boolean;
    limits?: Limits;
}): {
    resolve: (node: RenderNode) => RenderPlan;
};
