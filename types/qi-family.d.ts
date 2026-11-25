export declare const qiReference = "\u2FF3\u5405\u72AC\u5405";
export declare const isQiFamily: (node: any) => boolean;
export declare function qiFamilyDonors(node: any): string[];
export declare function qiFamilyParts(composer: any, node: any, region: any, measure: any): {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    fixed: boolean;
}[] | null;
