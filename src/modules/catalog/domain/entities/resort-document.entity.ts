import { Entity } from '../../../../shared/domain/base/entity.base';

export type DocumentStatusValue = 'pending' | 'approved' | 'rejected';
export type DocumentTypeValue = 'rnt' | 'camara_comercio' | 'rut' | 'insurance' | 'license' | 'other';

export interface ResortDocumentProps {
    resortId: string;
    docType: DocumentTypeValue;
    fileUrl: string;
    status: DocumentStatusValue;
    rejectionReason?: string;
    uploadedBy: string;
    approvedBy?: string;
    approvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export class ResortDocument extends Entity<ResortDocumentProps> {
    private constructor(id: string, props: ResortDocumentProps) {
        super(id, props);
    }

    get resortId(): string { return this.props.resortId; }
    get docType(): DocumentTypeValue { return this.props.docType; }
    get fileUrl(): string { return this.props.fileUrl; }
    get status(): DocumentStatusValue { return this.props.status; }
    get rejectionReason(): string | undefined { return this.props.rejectionReason; }
    get uploadedBy(): string { return this.props.uploadedBy; }
    get approvedBy(): string | undefined { return this.props.approvedBy; }
    get approvedAt(): Date | undefined { return this.props.approvedAt; }
    get createdAt(): Date { return this.props.createdAt; }
    get updatedAt(): Date { return this.props.updatedAt; }

    get isPending(): boolean { return this.props.status === 'pending'; }
    get isApproved(): boolean { return this.props.status === 'approved'; }
    get isRejected(): boolean { return this.props.status === 'rejected'; }

    static create(params: {
        id: string;
        resortId: string;
        docType: DocumentTypeValue;
        fileUrl: string;
        uploadedBy: string;
    }): ResortDocument {
        if (!params.fileUrl.startsWith('http')) {
            throw new Error('Invalid document URL');
        }

        return new ResortDocument(params.id, {
            resortId: params.resortId,
            docType: params.docType,
            fileUrl: params.fileUrl,
            status: 'pending',
            uploadedBy: params.uploadedBy,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    static reconstitute(id: string, props: ResortDocumentProps): ResortDocument {
        return new ResortDocument(id, props);
    }

    approve(approvedBy: string): void {
        if (!this.isPending) {
            throw new Error(`Cannot approve document in status: ${this.props.status}`);
        }
        this.props.status = 'approved';
        this.props.approvedBy = approvedBy;
        this.props.approvedAt = new Date();
        this.props.rejectionReason = undefined;
        this.props.updatedAt = new Date();
    }

    reject(reason: string): void {
        if (!this.isPending) {
            throw new Error(`Cannot reject document in status: ${this.props.status}`);
        }
        if (!reason.trim()) {
            throw new Error('Rejection reason is required');
        }
        this.props.status = 'rejected';
        this.props.rejectionReason = reason;
        this.props.updatedAt = new Date();
    }

    resetToPending(): void {
        this.props.status = 'pending';
        this.props.rejectionReason = undefined;
        this.props.approvedBy = undefined;
        this.props.approvedAt = undefined;
        this.props.updatedAt = new Date();
    }

    static getDocumentTypeLabel(docType: DocumentTypeValue): string {
        const labels: Record<DocumentTypeValue, string> = {
            rnt: 'Registro Nacional de Turismo',
            camara_comercio: 'Cámara de Comercio',
            rut: 'RUT',
            insurance: 'Póliza de Seguro',
            license: 'Licencia de Operación',
            other: 'Otro',
        };
        return labels[docType] || docType;
    }
}
