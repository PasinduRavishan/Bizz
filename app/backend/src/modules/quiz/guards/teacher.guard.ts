import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * TeacherGuard - Only allows teachers to access protected routes
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, TeacherGuard)
 * @Post('create')
 * createQuiz() { ... }
 */
@Injectable()
export class TeacherGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.role !== 'TEACHER') {
      throw new ForbiddenException('Only teachers can access this resource');
    }

    return true;
  }
}
