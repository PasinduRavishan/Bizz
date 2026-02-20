import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { CreateQuizDto, CreateQuizUIDto, RevealAnswersDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeacherGuard } from './guards/teacher.guard';

/**
 * QuizController - Handles quiz HTTP requests
 *
 * Routes:
 * - POST /quiz/create - Create quiz (teacher only)
 * - GET /quiz - List all quizzes
 * - GET /quiz/:id - Get single quiz
 * - PUT /quiz/:id/reveal - Reveal answers (teacher only)
 * - DELETE /quiz/:id - Delete quiz (teacher only)
 */
@Controller('quiz')
export class QuizController {
  constructor(private quizService: QuizService) {}

  /**
   * POST /quiz/create
   *
   * Create quiz with blockchain-ready data (matches test-complete-flow.sh)
   * For scripts and advanced users who have IPFS hash and hashed answers
   */
  @Post('create')
  @UseGuards(JwtAuthGuard, TeacherGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() createQuizDto: CreateQuizDto) {
    return this.quizService.create(req.user.id, createQuizDto);
  }

  /**
   * POST /quiz/create-ui
   *
   * Create quiz from UI (teacher only, frontend-friendly)
   * Accepts questions and answers, handles IPFS upload and hashing
   */
  @Post('create-ui')
  @UseGuards(JwtAuthGuard, TeacherGuard)
  @HttpCode(HttpStatus.CREATED)
  async createFromUI(@Request() req, @Body() createQuizUIDto: CreateQuizUIDto) {
    return this.quizService.createFromUI(req.user.id, createQuizUIDto);
  }

  /**
   * GET /quiz
   *
   * List all quizzes with optional filtering
   */
  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('teacherId') teacherId?: string
  ) {
    return this.quizService.findAll({ status, teacherId });
  }

  /**
   * GET /quiz/:id
   *
   * Get a single quiz (syncs from blockchain)
   * If authenticated, includes user's attempts
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    const userId = req.user?.id; // Optional auth
    return this.quizService.findOne(id, userId);
  }

  /**
   * PUT /quiz/:id/reveal
   *
   * Reveal quiz answers (teacher only, after deadline)
   */
  @Put(':id/reveal')
  @UseGuards(JwtAuthGuard, TeacherGuard)
  async revealAnswers(
    @Param('id') id: string,
    @Request() req,
    @Body() revealDto: RevealAnswersDto
  ) {
    return this.quizService.revealAnswers(id, req.user.id, revealDto);
  }

  /**
   * DELETE /quiz/:id
   *
   * Delete quiz (teacher only, only if no attempts)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, TeacherGuard)
  async remove(@Param('id') id: string, @Request() req) {
    return this.quizService.remove(id, req.user.id);
  }
}
