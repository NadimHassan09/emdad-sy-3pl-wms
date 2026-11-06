# MediaStorageService

> 30 nodes · cohesion 0.10

## Key Concepts

- **MediaStorageService** (15 connections) — `backend/src/modules/media/media-storage.service.ts`
- **.uploadProductImage()** (12 connections) — `backend/src/modules/client-portal/media/client-media.controller.ts`
- **ImageProcessingService** (12 connections) — `backend/src/modules/media/image-processing.service.ts`
- **.remove()** (10 connections) — `backend/src/modules/media/media-storage.service.ts`
- **ClientMediaController** (9 connections) — `backend/src/modules/client-portal/media/client-media.controller.ts`
- **.uploadLogo()** (9 connections) — `backend/src/modules/companies/companies.service.ts`
- **.uploadAvatar()** (8 connections) — `backend/src/modules/auth/auth.service.ts`
- **.deleteProductImage()** (8 connections) — `backend/src/modules/client-portal/media/client-media.controller.ts`
- **.uploadAvatar()** (7 connections) — `backend/src/modules/client-portal/auth/client-auth.service.ts`
- **.getProductImage()** (7 connections) — `backend/src/modules/client-portal/media/client-media.controller.ts`
- **.constructor()** (6 connections) — `backend/src/modules/client-portal/auth/client-auth.service.ts`
- **.constructor()** (5 connections) — `backend/src/modules/client-portal/media/client-media.controller.ts`
- **.constructor()** (5 connections) — `backend/src/modules/companies/companies.service.ts`
- **.compress()** (5 connections) — `backend/src/modules/media/image-processing.service.ts`
- **.write()** (5 connections) — `backend/src/modules/media/media-storage.service.ts`
- **Param** (3 connections)
- **.absolutePath()** (3 connections) — `backend/src/modules/media/media-storage.service.ts`
- **assertUploadedImage()** (2 connections) — `backend/src/modules/client-portal/media/client-media.controller.ts`
- **Controller** (1 connections)
- **Delete** (1 connections)
- **Get** (1 connections)
- **HttpCode** (1 connections)
- **Post** (1 connections)
- **Res** (1 connections)
- **UploadedFile** (1 connections)
- *... and 5 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (15 shared connections)
- [@nestjs/common](@nestjs-common.md) (14 shared connections)
- [ClientPrincipal](ClientPrincipal.md) (10 shared connections)
- [.assertCompanyAccess](assertCompanyAccess.md) (5 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (2 shared connections)
- [AuthController](AuthController.md) (2 shared connections)
- [app.module.ts](app.module.ts.md) (2 shared connections)
- [userRoleToAuthGroup](userRoleToAuthGroup.md) (1 shared connections)
- [AuthService](AuthService.md) (1 shared connections)
- [AuditLogService](AuditLogService.md) (1 shared connections)

## Source Files

- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/client-portal/auth/client-auth.service.ts`
- `backend/src/modules/client-portal/media/client-media.controller.ts`
- `backend/src/modules/companies/companies.service.ts`
- `backend/src/modules/media/image-processing.service.ts`
- `backend/src/modules/media/media-storage.service.ts`

## Audit Trail

- EXTRACTED: 75 (77%)
- INFERRED: 23 (23%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*