/** Faces whose bundled forms come only from their own font: Noto's must not stand in for them. @param {string} style */
export declare const ownFormsOnly: (style: string) => style is "fangsong" | "pen-writing" | "regular";
export declare const containsComponentForm: (text: any, style?: string) => boolean;
export declare const isAtomicForm: (text: any, style: any) => boolean;
export declare const isGroupedForm: (text: any, style?: string) => boolean;
export declare const isComponentForm: (text: any, style?: string) => boolean;
/** Whether `text` has a native form in `style`: one that keeps what the export knows of it. */
export declare const isNativeForm: (text: any, style?: string) => any;
/** Whether `text` holds a component whose form replaces the encoded character's own outline. */
export declare const hasForcedForms: (style: any) => boolean;
export declare const containsForcedForm: (text: any, style?: string) => any;
/** A character whose own glyph is kept, with only a component replaced. */
export declare const isForcedCharacter: (text: any, style?: string) => any;
export declare function componentRecord(text: any, style?: string): any;
/**
 * Forms cut from characters for components no code point names (a zi.tools stroke chain, a CHISE
 * entity), by their own text, loaded with `custom-forms.json.gz` once a sequence names one. A form
 * written above stays where both have one; TW-Kai, Wen Kai and Fangsong take none, having no cut of their own.
 * @param {{ forms?: Record<string, Record<string, { g: any[], from: string, face: string, record?: object }>> }} data
 */
export declare function addCutForms(data: {
    forms?: Record<string, Record<string, {
        g: any[];
        from: string;
        face: string;
        record?: object;
    }>>;
}): void;
export declare function componentParts(text: any, region?: number[], style?: string, atRoot?: boolean): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    fixed: boolean;
}[] | null;
export declare function componentDrawing(text: any, style?: string): {
    d: string;
    approximate: never[];
} | null;
/** A native contextual cut fitted to a caller's placement, with its own stroke weights. */
export declare function componentPosition(name: any, target: any, style?: string, designHeight?: null): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    fixed: boolean;
    inkLength: any;
} | null;
export declare const componentPositionBox: (name: any, style?: string) => any;
