// Deployment-ready Payment contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/Payment.ts instead

// @ts-expect-error - Bitcoin Computer library type definitions issue
export class Payment extends Contract {
    // Contract base properties
    _id;
    _rev;
    _owners;
    _satoshis;
    // Payment properties
    recipient;
    amount;
    claimed;
    constructor(recipient, amount) {
        super({
            recipient,
            amount,
            claimed: false,
            _owners: [recipient],
            _satoshis: amount
        });
    }
    cashOut() {
        if (this.claimed) {
            throw new Error('Already claimed');
        }
        if (this._owners[0] !== this.recipient) {
            throw new Error('Only recipient can cash out');
        }
        this.claimed = true;
        // Transfer remaining funds to recipient
        this._owners = [this.recipient];
    }
}
//# sourceMappingURL=Payment.js.map