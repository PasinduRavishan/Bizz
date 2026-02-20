import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { AccessRequestService } from './access-request.service';
import { CreateAccessRequestDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeacherGuard } from '../quiz/guards/teacher.guard';

/**
 * AccessRequestController - Handles quiz access requests
 *
 * Routes:
 * - POST /access-request - Student requests access
 * - GET /access-request/student - Get student's requests
 * - GET /access-request/teacher - Get teacher's pending requests
 * - PUT /access-request/:id/approve - Teacher approves (creates partial tx)
 * - POST /access-request/:id/pay - Student pays (completes tx)
 * - POST /access-request/:id/claim - Teacher claims entry fee payment
 * - POST /access-request/:id/start - Student burns token and starts attempt
 */
@Controller('access-request')
@UseGuards(JwtAuthGuard)
export class AccessRequestController {
  constructor(private accessRequestService: AccessRequestService) {}

  /**
   * POST /access-request
   *
   * Student requests quiz access
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async requestAccess(@Request() req, @Body() createDto: CreateAccessRequestDto) {
    return this.accessRequestService.requestAccess(req.user.id, createDto);
  }

  /**
   * GET /access-request/student
   *
   * Get student's access requests
   */
  @Get('student')
  async getStudentRequests(@Request() req) {
    return this.accessRequestService.getStudentRequests(req.user.id);
  }

  /**
   * GET /access-request/teacher
   *
   * Get teacher's pending requests (teacher only)
   */
  @Get('teacher')
  @UseGuards(TeacherGuard)
  async getTeacherRequests(@Request() req) {
    return this.accessRequestService.getTeacherRequests(req.user.id);
  }

  /**
   * PUT /access-request/:id/approve
   *
   * Teacher approves request and creates partial exec tx
   */
  @Put(':id/approve')
  @UseGuards(TeacherGuard)
  async approveRequest(@Param('id') id: string, @Request() req) {
    return this.accessRequestService.approveRequest(id, req.user.id);
  }

  /**
   * POST /access-request/:id/pay
   *
   * Student completes payment
   */
  @Post(':id/pay')
  async completePayment(@Param('id') id: string, @Request() req) {
    return this.accessRequestService.completePayment(id, req.user.id);
  }

  /**
   * POST /access-request/:id/claim
   *
   * Teacher claims entry fee payment (teacher only)
   */
  @Post(':id/claim')
  @UseGuards(TeacherGuard)
  async claimPayment(@Param('id') id: string, @Request() req) {
    return this.accessRequestService.claimPayment(id, req.user.id);
  }

  /**
   * POST /access-request/:id/start
   *
   * Student burns quiz token and starts attempt
   */
  @Post(':id/start')
  async startAttempt(@Param('id') id: string, @Request() req) {
    return this.accessRequestService.startAttempt(id, req.user.id);
  }
}
