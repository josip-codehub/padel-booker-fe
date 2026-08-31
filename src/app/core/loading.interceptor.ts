import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from './loading.service';

/**
 * Shows the global loading overlay for the duration of each API call.
 * Skips the health check so background token pings don't block the UI.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/api/health')) {
    return next(req);
  }
  const loading = inject(LoadingService);
  loading.begin();
  return next(req).pipe(finalize(() => loading.end()));
};
