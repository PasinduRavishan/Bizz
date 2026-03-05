"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuizAttemptModule = void 0;
const common_1 = require("@nestjs/common");
const quiz_attempt_controller_1 = require("./quiz-attempt.controller");
const quiz_attempt_service_1 = require("./quiz-attempt.service");
const auth_module_1 = require("../auth/auth.module");
let QuizAttemptModule = class QuizAttemptModule {
};
exports.QuizAttemptModule = QuizAttemptModule;
exports.QuizAttemptModule = QuizAttemptModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule],
        controllers: [quiz_attempt_controller_1.QuizAttemptController],
        providers: [quiz_attempt_service_1.QuizAttemptService],
        exports: [quiz_attempt_service_1.QuizAttemptService],
    })
], QuizAttemptModule);
//# sourceMappingURL=quiz-attempt.module.js.map