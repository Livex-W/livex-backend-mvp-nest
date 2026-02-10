import { Entity } from '../../../../shared/domain/base/entity.base';

export interface FavoriteProps {
    userId: string;
    experienceId: string;
    createdAt: Date;
}

export class Favorite extends Entity<FavoriteProps> {
    private constructor(id: string, props: FavoriteProps) {
        super(id, props);
    }

    get userId(): string { return this.props.userId; }
    get experienceId(): string { return this.props.experienceId; }
    get createdAt(): Date { return this.props.createdAt; }

    static create(params: {
        id: string;
        userId: string;
        experienceId: string;
    }): Favorite {
        return new Favorite(params.id, {
            userId: params.userId,
            experienceId: params.experienceId,
            createdAt: new Date(),
        });
    }

    static reconstitute(id: string, props: FavoriteProps): Favorite {
        return new Favorite(id, props);
    }
}
