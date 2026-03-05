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
exports.QuizController = void 0;
const common_1 = require("@nestjs/common");
const quiz_service_1 = require("./quiz.service");
const dto_1 = require("./dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const teacher_guard_1 = require("./guards/teacher.guard");
let QuizController = class QuizController {
    quizService;
    constructor(quizService) {
        this.quizService = quizService;
    }
    async create(req, createQuizDto) {
        return this.quizService.create(req.user.id, createQuizDto);
    }
    async createFromUI(req, createQuizUIDto) {
        return this.quizService.createFromUI(req.user.id, createQuizUIDto);
    }
    async findAll(status, teacherId) {
        return this.quizService.findAll({ status, teacherId });
    }
    async findOne(id, req) {
        const userId = req.user?.id;
        return this.quizService.findOne(id, userId);
    }
    async revealAnswers(id, req, revealDto) {
        return this.quizService.revealAnswers(id, req.user.id, revealDto);
    }
    async remove(id, req) {
        return this.quizService.remove(id, req.user.id);
    }
};
exports.QuizController = QuizController;
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, teacher_guard_1.TeacherGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CreateQuizDto]),
    __metadata("design:returntype", Promise)
], QuizController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('create-ui'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, teacher_guard_1.TeacherGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CreateQuizUIDto]),
    __metadata("design:returntype", Promise)
], QuizController.prototype, "createFromUI", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('teacherId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], QuizController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], QuizController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id/reveal'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, teacher_guard_1.TeacherGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, dto_1.RevealAnswersDto]),
    __metadata("design:returntype", Promise)
], QuizController.prototype, "revealAnswers", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, teacher_guard_1.TeacherGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], QuizController.prototype, "remove", null);
exports.QuizController = QuizController = __decorate([
    (0, common_1.Controller)('quiz'),
    __metadata("design:paramtypes", [quiz_service_1.QuizService])
], QuizController);
//# sourceMappingURL=quiz.controller.js.map