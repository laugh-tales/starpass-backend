import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

export class SetCategoriesDto {
  @IsArray()
  @IsString({ each: true })
  categoryIds: string[];
}

@ApiTags('categories')
@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all available content categories' })
  @ApiResponse({ status: 200, description: 'Return list of categories' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Patch('creators/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set categories for a creator (replaces existing)' })
  @ApiResponse({ status: 200, description: 'Categories updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Creator or category not found' })
  setCreatorCategories(
    @Param('id') creatorId: string,
    @Body() dto: SetCategoriesDto,
  ) {
    return this.categoriesService.setCreatorCategories(creatorId, dto.categoryIds);
  }
}
