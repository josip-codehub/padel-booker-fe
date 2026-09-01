import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/** Blocks protected routes when not logged in. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.authenticated() ? true : router.parseUrl('/login');
};

/** Admin-only routes. Loads the account first if the role isn't known yet. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.authenticated()) return router.parseUrl('/login');

  const u = auth.currentUser();
  if (u) return u.role === 'ADMIN' ? true : router.parseUrl('/availability');

  return auth.loadAccount().pipe(
    map((loaded) => (loaded.role === 'ADMIN' ? true : router.parseUrl('/availability'))),
    catchError(() => of(router.parseUrl('/login'))),
  );
};
