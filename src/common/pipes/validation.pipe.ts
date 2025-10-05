import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

type Constructor = new (...args: unknown[]) => unknown;

@Injectable()
export class ValidationPipe implements PipeTransform<unknown> {
  async transform(value: unknown, { metatype }: ArgumentMetadata): Promise<unknown> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Transform the object
    });

    if (errors.length > 0) {
      const details = errors.reduce((acc, error) => {
        const field = error.property;
        const messages = error.constraints ? Object.values(error.constraints) : [];
        acc[field] = messages;
        return acc;
      }, {} as Record<string, string[]>);

      throw new BadRequestException({
        error: 'Bad Request',
        message: 'Validation failed',
        details,
      });
    }

    return object;
  }

  private toValidate(metatype: Constructor): boolean {
    const types: Constructor[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
