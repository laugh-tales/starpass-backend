import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BlocksService } from './blocks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('blocks')
@Controller('creators/:address/blocks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BlocksController {
  constructor(private blocksService: BlocksService) {}

  @Post()
  @ApiOperation({ summary: 'Block a fan from purchasing passes (creator only)' })
  @ApiResponse({ status: 201, description: 'Fan blocked' })
  @ApiResponse({ status: 409, description: 'Fan already blocked' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  blockFan(
    @Param('address') address: string,
    @Body() body: { fanAddress: string; reason?: string },
    @Request() req: any,
  ) {
    return this.blocksService.blockFan(req.user.address, body.fanAddress, body.reason);
  }

  @Delete(':fanAddress')
  @ApiOperation({ summary: 'Unblock a fan (creator only)' })
  @ApiResponse({ status: 200, description: 'Fan unblocked' })
  @ApiResponse({ status: 404, description: 'Block not found' })
  unblockFan(
    @Param('address') address: string,
    @Param('fanAddress') fanAddress: string,
    @Request() req: any,
  ) {
    return this.blocksService.unblockFan(req.user.address, fanAddress);
  }

  @Get()
  @ApiOperation({ summary: 'List all blocked fans for a creator' })
  @ApiResponse({ status: 200, description: 'List of blocked fans' })
  listBlocks(@Param('address') address: string, @Request() req: any) {
    return this.blocksService.listBlocks(req.user.address);
  }
}
