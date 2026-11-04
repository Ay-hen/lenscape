import { GeoPoint, ISODateTime, Role } from './common';

export type AccountStatus = 'active' | 'suspended' | 'pending';

export interface User {
  id: string;
  role: Role;
  name: string;
  username: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  city?: string;
  status: AccountStatus;
  createdAt: ISODateTime;
  lastActiveAt?: ISODateTime;
}

export interface SavedLocation { id: string; label: string; address: string; point: GeoPoint }

export interface CustomerProfile extends User {
  savedLocations: SavedLocation[];
  notificationPrefs: NotificationPrefs;
}

export interface NotificationPrefs { email: boolean; push: boolean; sms: boolean; marketing: boolean }

export interface Session {
  token: string; // JWT issued by the backend
  role: Role;
  user: User;
}

export interface LoginRequest { username: string; password: string }
export interface RegisterCustomerRequest { name: string; username: string; email: string; password: string }
export interface RegisterPhotographerRequest extends RegisterCustomerRequest { phone: string; city: string }
/** Answer of registration: no account exists yet — a 6-digit code was e-mailed and must be confirmed (see AuthRepository.verifyEmail). */
/** Answer of POST /auth/password/forgot|resend: always the same, whether or not an account uses the address. */
export interface PasswordResetCodeSent { expiresInSeconds: number; resendAfterSeconds: number }
/** Answer of POST /auth/password/verify: the single-use, short-lived authorisation that the final reset step requires. */
export interface PasswordResetGrant { resetToken: string; expiresInSeconds: number }
export interface RegistrationStarted { message: string; email: string; verificationRequired: boolean; otpExpiresInSeconds: number }
