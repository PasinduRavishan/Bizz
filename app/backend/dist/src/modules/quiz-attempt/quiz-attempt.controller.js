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
exports.QuizAttemptController = void 0;
const common_1 = require("@nestjs/common");
const quiz_attempt_service_1 = require("./quiz-attempt.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const submit_commitment_dto_1 = require("./dto/submit-commitment.dto");
const verify_attempt_dto_1 = require("./dto/verify-attempt.dto");
let QuizAttemptController = class QuizAttemptController {
    quizAttemptService;
    constructor(quizAttemptService) {
        this.quizAttemptService = quizAttemptService;
    }
    async submitCommitment(attemptId, dto, req) {
        return this.quizAttemptService.submitCommitment(attemptId, req.user.id, dto);
    }
    async verifyAttempt(attemptId, dto, req) {
        return this.quizAttemptService.verifyAttempt(attemptId, req.user.id, dto);
    }
    async getStudentAttempts(req) {
        return this.quizAttemptService.getStudentAttempts(req.user.id);
    }
    async getAttempt(attemptId, req) {
        return this.quizAttemptService.getAttempt(attemptId, req.user.id);
    }
};
exports.QuizAttemptController = QuizAttemptController;
__decorate([
    (0, common_1.Post)(':id/submit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submit_commitment_dto_1.SubmitCommitmentDto, Object]),
    __metadata("design:returntype", Promise)
], QuizAttemptController.prototype, "submitCommitment", null);
__decorate([
    (0, common_1.Post)(':id/verify'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, verify_attempt_dto_1.VerifyAttemptDto, Object]),
    __metadata("design:returntype", Promise)
], QuizAttemptController.prototype, "verifyAttempt", null);
__decorate([
    (0, common_1.Get)('student'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QuizAttemptController.prototype, "getStudentAttempts", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], QuizAttemptController.prototype, "getAttempt", null);
exports.QuizAttemptController = QuizAttemptController = __decorate([
    (0, common_1.Controller)('quiz-attempt'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [quiz_attempt_service_1.QuizAttemptService])
], QuizAttemptController);
//# sourceMappingURL=quiz-attempt.controller.js.map