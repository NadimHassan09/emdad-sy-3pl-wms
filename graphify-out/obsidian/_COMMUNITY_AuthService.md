---
type: community
cohesion: 0.21
members: 22
---

# AuthService

**Cohesion:** 0.21 - loosely connected
**Members:** 22 nodes

## Members
- [[dot-buildCookieBase()]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-changePassword()_1]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-clearAccessCookie()]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-clearAuthCookies()]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-clearRefreshCookie()]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-createSession()]] - code - backend/src/modules/auth/refresh-session.service.ts
- [[dot-emitAuthSessionChanged()]] - code - backend/src/modules/realtime/realtime.service.ts
- [[dot-expiresInToMs()]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-getCookieDomain()]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-invalidateUserSessions()]] - code - backend/src/modules/auth/refresh-session.service.ts
- [[dot-isProduction()]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-issueInternalSession()]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-logout()_1]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-readRefreshToken()]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-refresh()_1]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-setAccessCookie()]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-setRefreshCookie()]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-signRefreshToken()]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-tryVerifyRefreshToken()]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-verifyRefreshToken()]] - code - backend/src/modules/auth/auth.service.ts
- [[AuthService]] - code - backend/src/modules/auth/auth.service.ts
- [[Injectable_34]] - code

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/AuthService
SORT file.name ASC
```

## Connections to other communities
- 6 edges to [[_COMMUNITY_AuditLogService]]
- 6 edges to [[_COMMUNITY_dot-fromPrincipal]]
- 5 edges to [[_COMMUNITY_dot-login]]
- 4 edges to [[_COMMUNITY_AuthController]]
- 4 edges to [[_COMMUNITY_RealtimeService]]
- 3 edges to [[_COMMUNITY_userRoleToAuthGroup]]
- 2 edges to [[_COMMUNITY_@prismaclient]]
- 2 edges to [[_COMMUNITY_dot-assertCompanyAccess]]
- 1 edge to [[_COMMUNITY_@nestjscommon]]
- 1 edge to [[_COMMUNITY_app.module.ts]]
- 1 edge to [[_COMMUNITY_GoogleOAuthService]]
- 1 edge to [[_COMMUNITY_MediaStorageService]]
- 1 edge to [[_COMMUNITY_AuthPrincipal]]
- 1 edge to [[_COMMUNITY_ChangePasswordDto]]
- 1 edge to [[_COMMUNITY_UsersService]]
- 1 edge to [[_COMMUNITY_UsersController]]

## Top bridge nodes
- [[AuthService]] - degree 30, connects to 9 communities
- [[dot-emitAuthSessionChanged()]] - degree 10, connects to 4 communities
- [[dot-changePassword()_1]] - degree 8, connects to 4 communities
- [[dot-issueInternalSession()]] - degree 13, connects to 3 communities
- [[dot-refresh()_1]] - degree 12, connects to 3 communities