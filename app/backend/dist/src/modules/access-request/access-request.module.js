"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessRequestModule = void 0;
const common_1 = require("@nestjs/common");
const access_request_controller_1 = require("./access-request.controller");
const access_request_service_1 = require("./access-request.service");
const auth_module_1 = require("../auth/auth.module");
const quiz_module_1 = require("../quiz/quiz.module");
let AccessRequestModule = class AccessRequestModule {
};
exports.AccessRequestModule = AccessRequestModule;
exports.AccessRequestModule = AccessRequestModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, quiz_module_1.QuizModule],
        controllers: [access_request_controller_1.AccessRequestController],
        providers: [access_request_service_1.AccessRequestService],
        exports: [access_request_service_1.AccessRequestService],
    })
], AccessRequestModule);
//# sourceMappingURL=access-request.module.js.map