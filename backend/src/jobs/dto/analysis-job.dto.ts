import { IsMongoId } from 'class-validator';
export class AnalysisJobDto { @IsMongoId() uploadId: string; }
