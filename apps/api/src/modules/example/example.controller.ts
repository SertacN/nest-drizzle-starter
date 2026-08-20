import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../../core/http/decorators';
import { ParseUuid } from '../../core/http/pipes';
import type { ServiceResponse } from '../../core/http/types';
import { JwtGuard } from '../auth';
import { CreateExampleDto, ExampleResponseDto, ListExamplesDto, UpdateExampleDto } from './dto';
import { ExampleService } from './example.service';

/**
 * The authenticated surface. Guards sit on the controller, so reading the decorators above the
 * class tells you the audience without opening a single handler.
 */
@ApiTags('Examples')
@ApiCookieAuth()
@UseGuards(JwtGuard)
@Controller('examples')
export class ExampleController {
	constructor(private readonly exampleService: ExampleService) {}

	@Get()
	@ApiOperation({ summary: 'List own examples (paginated)' })
	@ApiResponse({ status: 200, type: [ExampleResponseDto] })
	async list(@GetUser('id') userId: string, @Query() query: ListExamplesDto): Promise<ServiceResponse<ExampleResponseDto[]>> {
		const { items, meta } = await this.exampleService.list(userId, query);
		return { message: 'Examples loaded', data: items, meta };
	}

	@Get(':id')
	@ApiOperation({ summary: 'One example' })
	@ApiResponse({ status: 200, type: ExampleResponseDto })
	@ApiResponse({ status: 404, description: 'example_not_found' })
	async get(
		@GetUser('id') userId: string,
		// The id reaches a WHERE clause, so it is validated as a UUID before it gets there.
		@Param('id', ParseUuid) id: string,
	): Promise<ServiceResponse<ExampleResponseDto>> {
		return { message: 'Example loaded', data: await this.exampleService.get(userId, id) };
	}

	@Post()
	@ApiOperation({ summary: 'Create an example' })
	@ApiResponse({ status: 201, type: ExampleResponseDto })
	async create(@GetUser('id') userId: string, @Body() dto: CreateExampleDto): Promise<ServiceResponse<ExampleResponseDto>> {
		return { message: 'Example created', data: await this.exampleService.create(userId, dto) };
	}

	@Patch(':id')
	@ApiOperation({ summary: 'Update an example' })
	@ApiResponse({ status: 200, type: ExampleResponseDto })
	async update(@GetUser('id') userId: string, @Param('id', ParseUuid) id: string, @Body() dto: UpdateExampleDto): Promise<ServiceResponse<ExampleResponseDto>> {
		return { message: 'Example updated', data: await this.exampleService.update(userId, id, dto) };
	}

	@Delete(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Deactivate an example (soft delete)' })
	async remove(@GetUser('id') userId: string, @Param('id', ParseUuid) id: string): Promise<ServiceResponse<null>> {
		await this.exampleService.deactivate(userId, id);
		return { message: 'Example deleted', data: null };
	}
}
