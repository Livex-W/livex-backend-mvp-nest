import { Module } from '@nestjs/common';
import { PartnerController } from './partner.controller';
import { CommonModule } from '../common/common.module';
import { PartnerService } from './partner.service';

@Module({
    imports: [CommonModule],
    controllers: [PartnerController],
    providers: [PartnerService],
    exports: [PartnerService],
})
export class PartnerModule { }
