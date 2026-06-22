import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search creators and tiers' })
  @ApiQuery({ name: 'q', description: 'Search query (min 2 characters)' })
  @ApiResponse({ status: 200, description: 'Matching creators and tiers' })
  @ApiResponse({ status: 400, description: 'Query too short' })
  search(@Query('q') q: string) {
    return this.searchService.search(q ?? '');
  }
}
