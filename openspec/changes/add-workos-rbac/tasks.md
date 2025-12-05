# Tasks: WorkOS RBAC Integration

## 1. WorkOS Dashboard Configuration
- [ ] 1.1 Define CRUD permissions in WorkOS Dashboard:
  - `org:admin` (full access bypass)
  - `schemas:read`, `schemas:create`, `schemas:update`, `schemas:delete`
  - `rules:read`, `rules:create`, `rules:update`, `rules:delete`
  - `team:read`, `team:invite`, `team:update`, `team:remove`
  - `billing:read`, `billing:update`
  - `audit:read`, `audit:export`
  - `settings:read`, `settings:update`
- [ ] 1.2 Configure default roles with permission mappings:
  - `owner` → `org:admin`
  - `admin` → `schemas:*`, `rules:*`, `team:*`, `billing:read`, `settings:*`
  - `editor` → `schemas:*`, `rules:*`
  - `member` → `schemas:read`, `rules:read`
- [ ] 1.3 Set `member` as default role for new memberships

> **Note**: Tasks 1.1-1.3 require manual configuration in WorkOS Dashboard at https://dashboard.workos.com

## 2. Schema Updates
- [x] 2.1 Add `roles` table to `convex/schema.ts` (slug, name, permissions array, isDefault, source)
- [x] 2.2 Add `permissions` table to `convex/schema.ts` (slug, name, description)
- [x] 2.3 Update `organizationMemberships` to include `roleSlug` and `permissions` array
- [x] 2.4 Add indexes for efficient permission lookups

## 3. RBAC Sync Infrastructure
- [x] 3.1 Create `convex/rbac/internal/mutation.ts` with upsert/delete handlers for roles and permissions
- [x] 3.2 Create `convex/rbac/internal/query.ts` with helpers for role/permission lookups
- [x] 3.3 Create `convex/rbac/query.ts` with public queries for roles and permissions
- [x] 3.4 Create seed functions for default roles and permissions
- [ ] 3.5 Create scheduled sync action to reconcile RBAC state from WorkOS API (future enhancement)

## 4. Permission Checking Utilities
- [x] 4.1 Create `convex/rbac/utils.ts` with helper functions:
  - `hasPermission(permissions, required)` – check with wildcard resolution and admin bypass
  - `hasAnyPermission(permissions, required[])` – check if user has any of the permissions
  - `hasAllPermissions(permissions, required[])` – check if user has all permissions
  - `getUserPermissions(ctx, orgId)` – get all permissions for user in org
- [x] 4.2 Implement wildcard resolution: `schemas:*` grants `schemas:read`, `schemas:create`, etc.
- [x] 4.3 Implement `org:admin` bypass for full access
- [x] 4.4 Add permission type definitions in `convex/types/index.ts`:
  - `Permission` type with all valid permission strings
  - `Resource` type: `'schemas' | 'rules' | 'team' | 'billing' | 'audit' | 'settings'`
  - `Action` type: `'read' | 'create' | 'update' | 'delete' | '*'`

## 5. New Function Builders
- [x] 5.1 Create `protectedQueryWithPermission(permission)` query builder in `convex/functions.ts`
- [x] 5.2 Create `protectedMutationWithPermission(permission)` mutation builder
- [x] 5.3 Create `protectedActionWithPermission(permission)` action builder
- [x] 5.4 Create `protectedOrgAdminQuery/Mutation/Action` convenience builders

## 6. Update Membership Webhook Processing
- [x] 6.1 Update `convex/organizationMemberships/internal/mutation.ts` to store roleSlug and permissions
- [x] 6.2 Update `convex/workos/events/process.ts` membership handlers to extract and store permissions
- [x] 6.3 Create helper to denormalize permissions from role slug

## 7. Frontend Permission Provider
- [x] 7.1 Create `components/rbac/permission-context.tsx` with PermissionProvider and usePermissions hook
- [x] 7.2 Create `components/rbac/require-permission.tsx` guard component
- [x] 7.3 Create `components/rbac/index.ts` for exports
- [x] 7.4 Add PermissionProvider to `app/(app)/layout.tsx`

## 8. Frontend Integration (Future - Incremental Migration)
- [ ] 8.1 Update `components/dashboard/navigation-sidebar.tsx` to hide/show items based on permissions
- [ ] 8.2 Update `app/(app)/administration/` pages to use permission guards
- [ ] 8.3 Update `app/(app)/catalog/` pages to use permission guards
- [ ] 8.4 Update `app/(app)/compatibility/` pages to use permission guards

## 9. Migrate Existing Admin Checks (Future - Incremental Migration)
- [ ] 9.1 Identify all usages of `protectedAdminQuery/Mutation/Action`
- [ ] 9.2 Create migration plan for each usage (which permission to use)
- [ ] 9.3 Migrate audit log queries to use `org:audit` permission
- [ ] 9.4 Keep backward compatibility for global admin role (platform superadmin)

## 10. Testing & Documentation
- [ ] 10.1 Test webhook sync with WorkOS dashboard changes
- [ ] 10.2 Test permission enforcement on protected endpoints
- [ ] 10.3 Test frontend permission guards render correctly
- [ ] 10.4 Document permission model in project docs

---

## Summary

### Completed (Core Infrastructure)
- ✅ Schema updates with roles, permissions tables
- ✅ RBAC sync mutations and queries
- ✅ Permission checking utilities with wildcard support
- ✅ New function builders for permission-based access control
- ✅ Membership webhook processing with permission denormalization
- ✅ Frontend permission context, hooks, and guard components

### Pending (Manual/Future Work)
- ⏳ WorkOS Dashboard configuration (manual step)
- ⏳ Frontend integration (incremental migration)
- ⏳ Existing admin check migration (incremental migration)
- ⏳ Testing and documentation
