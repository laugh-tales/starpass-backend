import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreatorMembersService } from './creator-members.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../common/prisma.service';
import { NotFoundException } from '@nestjs/common';

@ApiTags('creator-members')
@Controller('creators/:id/members')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreatorMembersController {
  constructor(
    private creatorMembersService: CreatorMembersService,
    private prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Add a co-owner or editor to a creator profile (owner only)' })
  @ApiResponse({ status: 201, description: 'Member added' })
  @ApiResponse({ status: 400, description: 'Cannot add original creator as member' })
  @ApiResponse({ status: 403, description: 'Only owners can manage members' })
  @ApiResponse({ status: 409, description: 'Member already exists' })
  async addMember(
    @Param('id') id: string,
    @Body() body: { address: string; role: 'OWNER' | 'EDITOR' },
    @Request() req: any,
  ) {
    return this.creatorMembersService.addMember(id, req.user.address, body.address, body.role ?? 'EDITOR');
  }

  @Delete(':address')
  @ApiOperation({ summary: 'Remove a member from a creator profile (owner only)' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  @ApiResponse({ status: 403, description: 'Only owners can manage members' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async removeMember(
    @Param('id') id: string,
    @Param('address') address: string,
    @Request() req: any,
  ) {
    return this.creatorMembersService.removeMember(id, req.user.address, address);
  }

  @Get()
  @ApiOperation({ summary: 'List members of a creator profile' })
  @ApiResponse({ status: 200, description: 'List of members' })
  listMembers(@Param('id') id: string) {
    return this.creatorMembersService.listMembers(id);
  }
}
