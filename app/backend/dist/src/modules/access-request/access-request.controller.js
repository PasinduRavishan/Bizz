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
exports.AccessRequestController = void 0;
const common_1 = require("@nestjs/common");
const access_request_service_1 = require("./access-request.service");
const dto_1 = require("./dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const teacher_guard_1 = require("../quiz/guards/teacher.guard");
let AccessRequestController = class AccessRequestController {
    accessRequestService;
    constructor(accessRequestService) {
        this.accessRequestService = accessRequestService;
    }
    async requestAccess(req, createDto) {
        return this.accessRequestService.requestAccess(req.user.id, createDto);
    }
    async getStudentRequests(req) {
        return this.accessRequestService.getStudentRequests(req.user.id);
    }
    async getTeacherRequests(req) {
        return this.accessRequestService.getTeacherRequests(req.user.id);
    }
    async completePayment(id, req) {
        return this.accessRequestService.completePayment(id, req.user.id);
    }
    async claimPayment(id, req) {
        return this.accessRequestService.claimPayment(id, req.user.id);
    }
    async startAttempt(id, req) {
        return this.accessRequestService.startAttempt(id, req.user.id);
    }
};
exports.AccessRequestController = AccessRequestController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CreateAccessRequestDto]),
    __metadata("design:returntype", Promise)
], AccessRequestController.prototype, "requestAccess", null);
__decorate([
    (0, common_1.Get)('student'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccessRequestController.prototype, "getStudentRequests", null);
__decorate([
    (0, common_1.Get)('teacher'),
    (0, common_1.UseGuards)(teacher_guard_1.TeacherGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AccessRequestController.prototype, "getTeacherRequests", null);
__decorate([
    (0, common_1.Post)(':id/pay'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AccessRequestController.prototype, "completePayment", null);
__decorate([
    (0, common_1.Post)(':id/claim'),
    (0, common_1.UseGuards)(teacher_guard_1.TeacherGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AccessRequestController.prototype, "claimPayment", null);
__decorate([
    (0, common_1.Post)(':id/start'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AccessRequestController.prototype, "startAttempt", null);
exports.AccessRequestController = AccessRequestController = __decorate([
    (0, common_1.Controller)('access-request'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [access_request_service_1.AccessRequestService])
], AccessRequestController);
//# sourceMappingURL=access-request.controller.js.map