import {
	InvitesController,
	MembersController,
} from "@/modules/members/members.controller";
import { MembersService } from "@/modules/members/members.service";
import { Module } from "@nestjs/common";

@Module({
	controllers: [MembersController, InvitesController],
	providers: [MembersService],
	exports: [MembersService],
})
export class MembersModule {}
