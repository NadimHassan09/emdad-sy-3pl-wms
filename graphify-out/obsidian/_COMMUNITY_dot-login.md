---
type: community
cohesion: 0.29
members: 12
---

# .login

**Cohesion:** 0.29 - loosely connected
**Members:** 12 nodes

## Members
- [[dot-assertAllowed()]] - code - backend/src/common/security/login-brute-force.service.ts
- [[dot-completeLogin()]] - code - backend/src/modules/auth/google-oauth.service.ts
- [[dot-expiresInToMs()_1]] - code - backend/src/modules/client-portal/auth/client-auth.service.ts
- [[dot-hash()]] - code - backend/src/common/crypto/password.service.ts
- [[dot-isLegacyScrypt()]] - code - backend/src/common/crypto/password.service.ts
- [[dot-login()_1]] - code - backend/src/modules/auth/auth.service.ts
- [[dot-login()_2]] - code - backend/src/modules/client-portal/auth/client-auth.service.ts
- [[dot-recordFailure()]] - code - backend/src/common/security/login-brute-force.service.ts
- [[dot-recordSuccess()]] - code - backend/src/common/security/login-brute-force.service.ts
- [[dot-verify()]] - code - backend/src/common/crypto/password.service.ts
- [[getClientIp()]] - code - backend/src/common/security/request-ip.util.ts
- [[verifyScrypt()]] - code - backend/src/common/crypto/password.service.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/login
SORT file.name ASC
```

## Connections to other communities
- 8 edges to [[_COMMUNITY_@nestjscommon]]
- 6 edges to [[_COMMUNITY_GoogleOAuthService]]
- 6 edges to [[_COMMUNITY_@prismaclient]]
- 5 edges to [[_COMMUNITY_AuthService]]
- 4 edges to [[_COMMUNITY_AuditLogService]]
- 2 edges to [[_COMMUNITY_UsersService]]
- 2 edges to [[_COMMUNITY_dot-fromPrincipal]]
- 1 edge to [[_COMMUNITY_LoginDto]]
- 1 edge to [[_COMMUNITY_AuthController]]

## Top bridge nodes
- [[dot-hash()]] - degree 7, connects to 4 communities
- [[getClientIp()]] - degree 7, connects to 4 communities
- [[dot-login()_1]] - degree 11, connects to 3 communities
- [[dot-completeLogin()]] - degree 11, connects to 3 communities
- [[dot-verify()]] - degree 6, connects to 3 communities