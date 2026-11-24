export declare const CUSTOM_FORMS = "custom-forms.json.gz";
/** Whether a sequence names a component the file may hold: a CHISE entity (&CDP-8958;) or a zi.tools
 *  stroke chain (#(丿𠃊)) the grammar gives no character. @param {string} text */
export declare function hasCustomComponent(text: string): boolean;
/**
 * A source over `fallback` that answers the hosts of the components the file holds, in `style`, and
 * names their places in the manifest's host list; everything else is the fallback's. A description
 * that needs none of them still draws when the file cannot be read.
 * @param {{ fallback?: any, load?: () => Promise<any>, style?: string }} options
 */
export declare function customFormsSource({ fallback, load, style }?: {
    fallback?: any;
    load?: () => Promise<any>;
    style?: string;
}): {
    manifest: null;
    layout: null;
    ready: () => any;
    modelFiles: (options: any) => any;
    load: (names: any) => any;
    filesOf: (keys: any) => any;
    store(): {
        manifest: null;
        layout: null;
        missing: any;
        rec: (key: any) => any;
        hosts: (key: any, place: any) => any;
        places: (key: any) => any;
        kin: () => any;
    };
};
