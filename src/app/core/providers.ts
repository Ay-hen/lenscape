import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AppEnv, APP_ENV } from './config/app-config';
import {
  AdminRepository, AnalyticsRepository, AuthRepository, AutomationRepository, AvailabilityRepository, BookingRepository, CatalogRepository, CustomerRepository,
  FavoriteRepository, MessagingRepository, NotificationRepository, PaymentRepository, PhotographerWorkspaceRepository, ReviewRepository, UploadRepository,
} from './api/repositories';
import { HttpAdminRepository, HttpAnalyticsRepository } from './http/http-admin.repository';
import { HttpAuthRepository, HttpCustomerRepository } from './http/http-auth.repository';
import { HttpBookingRepository, HttpFavoriteRepository, HttpPaymentRepository, HttpReviewRepository } from './http/http-bookings.repository';
import { HttpAvailabilityRepository, HttpCatalogRepository, HttpWorkspaceRepository } from './http/http-catalog.repository';
import { HttpAutomationRepository, HttpMessagingRepository, HttpNotificationRepository, HttpUploadRepository } from './http/http-engagement.repository';

/** Binds every repository contract to its Spring Boot implementation. There is no mock or fallback data layer. */
export function provideDataLayer(env: AppEnv): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: APP_ENV, useValue: env },
    { provide: AuthRepository, useClass: HttpAuthRepository },
    { provide: CustomerRepository, useClass: HttpCustomerRepository },
    { provide: CatalogRepository, useClass: HttpCatalogRepository },
    { provide: PhotographerWorkspaceRepository, useClass: HttpWorkspaceRepository },
    { provide: AvailabilityRepository, useClass: HttpAvailabilityRepository },
    { provide: BookingRepository, useClass: HttpBookingRepository },
    { provide: PaymentRepository, useClass: HttpPaymentRepository },
    { provide: ReviewRepository, useClass: HttpReviewRepository },
    { provide: FavoriteRepository, useClass: HttpFavoriteRepository },
    { provide: NotificationRepository, useClass: HttpNotificationRepository },
    { provide: MessagingRepository, useClass: HttpMessagingRepository },
    { provide: UploadRepository, useClass: HttpUploadRepository },
    { provide: AutomationRepository, useClass: HttpAutomationRepository },
    { provide: AdminRepository, useClass: HttpAdminRepository },
    { provide: AnalyticsRepository, useClass: HttpAnalyticsRepository },
  ]);
}
