import { Computer } from '@bitcoin-computer/lib';
declare class ComputerManager {
    private static instance;
    private computers;
    private constructor();
    static getInstance(): ComputerManager;
    getComputer(mnemonic: string | null): Computer;
    clearComputer(mnemonic: string): void;
    clearAll(): void;
    getStats(): {
        totalInstances: number;
        mnemonics: string[];
    };
}
export declare const computerManager: ComputerManager;
export {};
