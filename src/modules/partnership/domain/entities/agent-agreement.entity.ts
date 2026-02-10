import { Entity } from '../../../../shared/domain/base/entity.base';

export type AgreementStatusValue = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface AgentAgreementProps {
    agentId: string;
    resortId: string;
    status: AgreementStatusValue;
    commissionPerAdultCents: number;
    commissionPerChildCents: number;
    rejectionReason?: string;
    approvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export class AgentAgreement extends Entity<AgentAgreementProps> {
    private constructor(id: string, props: AgentAgreementProps) {
        super(id, props);
    }

    get agentId(): string { return this.props.agentId; }
    get resortId(): string { return this.props.resortId; }
    get status(): AgreementStatusValue { return this.props.status; }
    get commissionPerAdultCents(): number { return this.props.commissionPerAdultCents; }
    get commissionPerChildCents(): number { return this.props.commissionPerChildCents; }
    get rejectionReason(): string | undefined { return this.props.rejectionReason; }
    get approvedAt(): Date | undefined { return this.props.approvedAt; }
    get createdAt(): Date { return this.props.createdAt; }
    get updatedAt(): Date { return this.props.updatedAt; }

    get isPending(): boolean { return this.props.status === 'pending'; }
    get isApproved(): boolean { return this.props.status === 'approved'; }
    get isRejected(): boolean { return this.props.status === 'rejected'; }
    get isSuspended(): boolean { return this.props.status === 'suspended'; }
    get isActive(): boolean { return this.isApproved; }

    static create(params: {
        id: string;
        agentId: string;
        resortId: string;
        commissionPerAdultCents: number;
        commissionPerChildCents: number;
    }): AgentAgreement {
        if (params.commissionPerAdultCents < 0 || params.commissionPerChildCents < 0) {
            throw new Error('Commission values cannot be negative');
        }

        return new AgentAgreement(params.id, {
            agentId: params.agentId,
            resortId: params.resortId,
            status: 'pending',
            commissionPerAdultCents: params.commissionPerAdultCents,
            commissionPerChildCents: params.commissionPerChildCents,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    static reconstitute(id: string, props: AgentAgreementProps): AgentAgreement {
        return new AgentAgreement(id, props);
    }

    approve(): void {
        if (!this.isPending) {
            throw new Error(`Cannot approve agreement in status: ${this.props.status}`);
        }
        this.props.status = 'approved';
        this.props.approvedAt = new Date();
        this.props.rejectionReason = undefined;
        this.props.updatedAt = new Date();
    }

    reject(reason: string): void {
        if (!this.isPending) {
            throw new Error(`Cannot reject agreement in status: ${this.props.status}`);
        }
        this.props.status = 'rejected';
        this.props.rejectionReason = reason;
        this.props.updatedAt = new Date();
    }

    suspend(): void {
        if (!this.isApproved) {
            throw new Error('Can only suspend approved agreements');
        }
        this.props.status = 'suspended';
        this.props.updatedAt = new Date();
    }

    reactivate(): void {
        if (!this.isSuspended) {
            throw new Error('Can only reactivate suspended agreements');
        }
        this.props.status = 'approved';
        this.props.updatedAt = new Date();
    }

    updateCommissions(adultCents: number, childCents: number): void {
        if (adultCents < 0 || childCents < 0) {
            throw new Error('Commission values cannot be negative');
        }
        this.props.commissionPerAdultCents = adultCents;
        this.props.commissionPerChildCents = childCents;
        this.props.updatedAt = new Date();
    }

    calculateCommission(adults: number, children: number): number {
        return (this.props.commissionPerAdultCents * adults) +
            (this.props.commissionPerChildCents * children);
    }
}
