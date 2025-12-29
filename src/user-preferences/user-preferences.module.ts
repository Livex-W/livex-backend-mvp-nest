import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { UserPreferencesService } from './user-preferences.service';
import { UserPreferencesController } from './user-preferences.controller';

@Module({
    imports: [DatabaseModule],
    controllers: [UserPreferencesController],
    providers: [UserPreferencesService],
    exports: [UserPreferencesService],
})
export class UserPreferencesModule { }
