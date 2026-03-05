import { Controller, Get, Post, Body, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { AccessRequestService } from './access-request.service';
import { CreateAccessRequestDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeacherGuard } from '../quiz/guards/teacher.guard';

/**
 * AccessRequestController - Handles quiz access requests
 *
 * Routes:
 * - POST /access-request          - Student requests access (AUTO-APPROVES immediately)
 * - GET /access-request/student   - Get student's requests
 * - GET /access-request/teacher   - Get teacher's requests (for fee collection UI)
 * - POST /access-request/:id/pay  - Student pays entry fee (completes partial tx)
 * - POST /access-request/:id/claim - Teacher claims entry fee payment
 * - POST /access-request/:id/start - Student burns token and starts attempt
 *
 * NOTE: PUT /access-request/:id/approve is DEPRECATED.
 * Approval is now automatic when a student requests access.
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
