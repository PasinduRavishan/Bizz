"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrizeController = void 0;
const common_1 = require("@nestjs/common");
const prize_service_1 = require("./prize.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const create_answer_proof_dto_1 = require("./dto/create-answer-proof.dto");
let PrizeController = class PrizeController {
    prizeService;
    constructor(prizeService) {
        this.prizeService = prizeService;
    }
    async createAnswerProof(dto, req) {
        return this.prizeService.createAnswerProof(req.user.id, dto);
    }
    async createPrizePayment(attemptId, req) {
        return this.prizeService.createPrizePayment(req.user.id, attemptId);
    }
    async createSwapTransaction(attemptId, req) {
        return this.prizeService.createSwapTransaction(req.user.id, attemptId);
    }
    async executeSwap(attemptId, req) {
        return this.prizeService.executeSwap(req.user.id, attemptId);
    }
    async claimPrize(attemptId, req) {
        return this.prizeService.claimPrize(req.user.id, attemptId);
    }
};
exports.PrizeController = PrizeController;
__decorate([
    (0, common_1.Post)('answer-proof'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_answer_proof_dto_1.CreateAnswerProofDto, Object]),
    __metadata("design:returntype", Promise)
], PrizeController.prototype, "createAnswerProof", null);
__decorate([
    (0, common_1.Post)(':attemptId/payment'),
    __param(0, (0, common_1.Param)('attemptId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PrizeController.prototype, "createPrizePayment", null);
__decorate([
    (0, common_1.Post)(':attemptId/swap-tx'),
    __param(0, (0, common_1.Param)('attemptId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PrizeController.prototype, "createSwapTransaction", null);
__decorate([
    (0, common_1.Post)(':attemptId/execute-swap'),
    __param(0, (0, common_1.Param)('attemptId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PrizeController.prototype, "executeSwap", null);
__decorate([
    (0, common_1.Post)(':attemptId/claim'),
    __param(0, (0, common_1.Param)('attemptId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PrizeController.prototype, "claimPrize", null);
exports.PrizeController = PrizeController = __decorate([
    (0, common_1.Controller)('prize'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [prize_service_1.PrizeService])
], PrizeController);
//# sourceMappingURL=prize.controller.js.map