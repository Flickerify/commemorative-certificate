# Admin Setup

## Setting Up Your First Admin User

Since all new users default to `USER` role, you need to manually promote your first admin user. Here are the options:

### Option 1: Using Convex Dashboard

1. Go to your Convex Dashboard
2. Navigate to the `users` table
3. Find your user record
4. Update the `role` field from `"USER"` to `"ADMIN"`

### Option 2: Using a Mutation (After first admin is set)

Once you have one admin user, you can use the `setAdminByEmail` mutation:

```typescript
import { api } from '@/convex/_generated/api';
import { useMutation } from 'convex/react';

const setAdmin = useMutation(api.users.admin.mutation.setAdminByEmail);

await setAdmin({ email: 'admin@example.com' });
```

### Option 3: Direct Database Update (Convex Dashboard)

The fastest way for the first admin:

1. Open Convex Dashboard → Data → `users` table
2. Find your user by email
3. Click Edit on the `role` field
4. Change from `"USER"` to `"ADMIN"`
5. Save

## Admin Panel Access

Once you have admin role:

- Navigate to `/admin` for the admin dashboard
- Navigate to `/admin/locations` to manage locations

The `AdminGuard` component automatically protects all routes under `/admin` and redirects non-admin users to the home page.

## Admin Functions

- `api.users.admin.isAdmin` - Check if current user is admin
- `api.users.admin.listUsers` - List all users (admin only)
- `api.users.admin.updateUserRole` - Update a user's role (admin only)
- `api.users.admin.mutation.setAdminByEmail` - Set admin by email (admin only)

