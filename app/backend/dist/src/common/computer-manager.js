"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computerManager = void 0;
const lib_1 = require("@bitcoin-computer/lib");
class ComputerManager {
    static instance;
    computers;
    constructor() {
        this.computers = new Map();
    }
    static getInstance() {
        if (!ComputerManager.instance) {
            ComputerManager.instance = new ComputerManager();
        }
        return ComputerManager.instance;
    }
    getComputer(mnemonic) {
        if (!mnemonic) {
            throw new Error('Mnemonic is required to create Computer instance');
        }
        if (!this.computers.has(mnemonic)) {
            console.log('  🔧 Creating new Computer instance for user');
            const computer = new lib_1.Computer({
                chain: process.env.BC_CHAIN || 'LTC',
                network: process.env.BC_NETWORK || 'regtest',
                mnemonic,
            });
            this.computers.set(mnemonic, computer);
        }
        else {
            console.log('  ♻️  Reusing existing Computer instance for user');
        }
        return this.computers.get(mnemonic);
    }
    clearComputer(mnemonic) {
        this.computers.delete(mnemonic);
    }
    clearAll() {
        this.computers.clear();
    }
    getStats() {
        return {
            totalInstances: this.computers.size,
            mnemonics: Array.from(this.computers.keys()).map(m => `${m.substring(0, 20)}...`),
        };
    }
}
exports.computerManager = ComputerManager.getInstance();
//# sourceMappingURL=computer-manager.js.map