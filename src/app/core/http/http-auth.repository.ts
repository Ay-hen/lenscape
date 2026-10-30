import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthRepository, CustomerRepository } from '../api/repositories';
import { CustomerProfile, LoginRequest, RegisterCustomerRequest, RegisterPhotographerRequest, RegistrationStarted, Role, Session, User } from '../models';
import { useApi } from './api';

interface AuthResponse { token: string; role: Role; user: User }
const toSession = (r: AuthResponse): Session => ({ token: r.token, role: r.user.role, user: r.user });

/**
 * POST /user/auth/login | /register | /logout, GET /user/me, POST /auth/password.
 * The server returns the signed-in account together with the token, so no second request is needed after login.
 */
@Injectable()
export class HttpAuthRepository extends AuthRepository {
  private api = useApi();
  override login(req: LoginRequest): Observable<Session> { return this.api.post<AuthResponse>('/user/auth/login', req).pipe(map(toSession)); }
  /** Step 1: validates the form and e-mails a 6-digit code. No account and no token exist until the code is confirmed. */
  override registerCustomer(req: RegisterCustomerRequest): Observable<RegistrationStarted> { return this.api.post<RegistrationStarted>('/user/auth/register', { ...req, role: 'client' }); }
  override registerPhotographer(req: RegisterPhotographerRequest): Observable<RegistrationStarted> { return this.api.post<RegistrationStarted>('/user/auth/register', { ...req, role: 'photographer' }); }
  /** Step 2: the code creates the account and returns the same answer as login. */
  override verifyEmail(email: string, otp: string): Observable<Session> { return this.api.post<AuthResponse>('/auth/otp/verify', { email, otp }).pipe(map(toSession)); }
  override resendCode(email: string): Observable<void> { return this.api.post<unknown>('/auth/otp/resend', { email }).pipe(map(() => undefined)); }
  /** The token is passed explicitly: by the time this runs the session store has already been cleared. */
  override logout(token: string): Observable<void> { return this.api.http.post<void>(this.api.url('/user/auth/logout'), null, { headers: { Authorization: `Bearer ${token}` } }); }
  override me(): Observable<User> { return this.api.get<User>('/user/me'); }
  override changePassword(current: string, next: string): Observable<void> { return this.api.post<void>('/auth/password', { current, next }); }
}

/** GET/PUT /customers/me */
@Injectable()
export class HttpCustomerRepository extends CustomerRepository {
  private api = useApi();
  override getProfile(): Observable<CustomerProfile> { return this.api.get<CustomerProfile>('/customers/me'); }
  override updateProfile(patch: Partial<CustomerProfile>): Observable<CustomerProfile> {
    const { name, email, phone, city, savedLocations, notificationPrefs, avatarUrl } = patch;
    return this.api.put<CustomerProfile>('/customers/me', { name, email, phone, city, savedLocations, notificationPrefs, avatarUrl });
  }
}
