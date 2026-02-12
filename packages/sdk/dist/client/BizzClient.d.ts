import type { Computer } from '@bitcoin-computer/lib';
export interface BizzClientConfig {
    computer: typeof Computer.prototype;
    modules?: {
        quiz?: string;
        payment?: string;
        attempt?: string;
        access?: string;
        redemption?: string;
        proof?: string;
        swap?: string;
    };
}
export declare class BizzClient {
    computer: typeof Computer.prototype;
    modules?: BizzClientConfig['modules'];
    constructor(config: BizzClientConfig);
}
//# sourceMappingURL=BizzClient.d.ts.map