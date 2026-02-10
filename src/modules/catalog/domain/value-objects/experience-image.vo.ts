import { ValueObject } from '../../../../shared/domain/base/value-object.base';

interface ExperienceImageProps {
    readonly url: string;
    readonly sortOrder: number;
    readonly imageType: 'gallery' | 'main' | 'thumbnail';
    readonly isPrimary: boolean;
}

export class ExperienceImage extends ValueObject<ExperienceImageProps> {
    private constructor(props: ExperienceImageProps) {
        super(props);
    }

    get url(): string { return this.props.url; }
    get sortOrder(): number { return this.props.sortOrder; }
    get imageType(): string { return this.props.imageType; }
    get isPrimary(): boolean { return this.props.isPrimary; }

    get isMainImage(): boolean {
        return this.props.imageType === 'main' || this.props.isPrimary;
    }

    get isThumbnail(): boolean {
        return this.props.imageType === 'thumbnail';
    }

    static create(params: {
        url: string;
        sortOrder?: number;
        imageType?: 'gallery' | 'main' | 'thumbnail';
        isPrimary?: boolean;
    }): ExperienceImage {
        if (!params.url || !params.url.startsWith('http')) {
            throw new Error('Invalid image URL');
        }

        return new ExperienceImage({
            url: params.url,
            sortOrder: params.sortOrder ?? 0,
            imageType: params.imageType ?? 'gallery',
            isPrimary: params.isPrimary ?? false,
        });
    }

    static mainImage(url: string): ExperienceImage {
        return new ExperienceImage({
            url,
            sortOrder: 0,
            imageType: 'main',
            isPrimary: true,
        });
    }

    withSortOrder(sortOrder: number): ExperienceImage {
        return new ExperienceImage({
            ...this.props,
            sortOrder,
        });
    }

    markAsPrimary(): ExperienceImage {
        return new ExperienceImage({
            ...this.props,
            isPrimary: true,
            imageType: 'main',
        });
    }

    protected equalsCore(other: ExperienceImage): boolean {
        return this.props.url === other.props.url;
    }
}
