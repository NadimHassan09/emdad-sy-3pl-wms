import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessEnvelope<T> | T> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<SuccessEnvelope<T> | T> {
    return next.handle().pipe(
      map((data) => {
        // If the controller already wrapped it, pass through as-is.
        if (data && typeof data === 'object' && 'success' in (data as object)) {
          return data;
        }
        return { success: true, data } as SuccessEnvelope<T>;
      }),
    );
  }
}
