import { ResortDocument } from '../entities/resort-document.entity';

export const RESORT_DOCUMENT_REPOSITORY = Symbol('RESORT_DOCUMENT_REPOSITORY');

export interface IResortDocumentRepository {
    save(document: ResortDocument): Promise<void>;
    findById(id: string): Promise<ResortDocument | null>;
    findByResortId(resortId: string): Promise<ResortDocument[]>;
    findPendingByResortId(resortId: string): Promise<ResortDocument[]>;
    findApprovedByResortId(resortId: string): Promise<ResortDocument[]>;
    delete(id: string): Promise<void>;
    deleteByResortId(resortId: string): Promise<void>;
}
