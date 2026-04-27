#!/usr/bin/env tsx
export declare function loadJSON<T>(p: string, fallback: T): Promise<T>;
declare function evolveManifest(): Promise<void>;
export declare const SinGalaxyManifestGen: {
    evolveManifest: typeof evolveManifest;
    validateManifest: () => Promise<boolean>;
};
export {};
//# sourceMappingURL=sin-galaxy-manifest-gen.d.ts.map