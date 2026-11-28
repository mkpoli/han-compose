export declare const yaoSources: {
    glyphwiki: {
        author: string;
        retrieved: string;
        license: string;
    };
    ivd: {
        name: string;
        family: string;
        form: string;
        author: string;
        edition: string;
        url: string;
        sequence: string;
        collection: string;
        identifier: string;
        outlineWitness: {
            source: string;
            program: string;
            target: string;
            resolved: string;
        };
    };
};
export declare const yaoFamily: {
    id: string;
    subjects: string[];
    reference: string;
    axes: {
        id: string;
        property: string;
        locus: {
            path: never[];
        }[];
        values: string[];
    }[];
    related: {
        name: string;
        id: string;
        components: string;
        relation: string;
        source: string;
        url: string;
    }[];
    forms: {
        id: string;
        text: string;
        aliases: string[];
        outline: {
            viewBox: string;
            d: string;
        };
        traits: {
            upperTurn: string;
        };
        design: {
            id: string;
            styleReference: string;
        };
        sources: ({
            name: string;
            family: string;
            form: string;
            author: string;
            edition: string;
            url: string;
            sequence: string;
            collection: string;
            identifier: string;
            outlineWitness: {
                source: string;
                program: string;
                target: string;
                resolved: string;
            };
        } | {
            name: string;
            region?: string | undefined;
            glyph: string;
            revision: number;
            author: string;
            url: string;
        } | ({
            name: string;
            face: string;
            edition: string;
            url: string;
            sha256: string;
        } & {
            regions: string[];
            glyph: string;
        }))[];
    }[];
};
