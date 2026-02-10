import { AgentAgreement } from '../entities/agent-agreement.entity';

export const AGENT_AGREEMENT_REPOSITORY = Symbol('AGENT_AGREEMENT_REPOSITORY');

export interface IAgentAgreementRepository {
    save(agreement: AgentAgreement): Promise<void>;
    findById(id: string): Promise<AgentAgreement | null>;
    findByAgentId(agentId: string): Promise<AgentAgreement[]>;
    findByResortId(resortId: string): Promise<AgentAgreement[]>;
    findByAgentAndResort(agentId: string, resortId: string): Promise<AgentAgreement | null>;
    findActiveByAgentId(agentId: string): Promise<AgentAgreement[]>;
    delete(id: string): Promise<void>;
}
