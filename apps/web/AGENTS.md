# AGENTS.md (apps/web)

Rules for `@erp/web` (Vite, React 19, React Router, TanStack Query, Tailwind v4, shadcn/ui). The [root AGENTS.md](../../AGENTS.md) still applies.

- **Talk to the API only through the typed client** `orpc` from `@/lib/orpc`. Read: `useQuery(orpc.<feature>.<route>.queryOptions({ input }))`. Write: `useMutation(orpc.<feature>.<route>.mutationOptions())`. No hand-written `fetch` calls or response types. Reference: `src/components/health-status.tsx`.
- **Requests go to `/api` on the same origin** (Vite proxies to NestJS). Don't hard-code the API URL.
- **Layout**: routes in `src/router.tsx`, pages in `src/routes/`, feature components in `src/components/`, shadcn/ui primitives in `src/components/ui` (generated, don't hand-edit).
- **Auth**: pages that need a user go under the `RequireAuth` route in `src/router.tsx`, which is the default for everything inside `RootLayout`. Get the user with `useCurrentUser()` from `@/lib/auth`. Don't handle 401s in components: the query client already redirects to `/login`.
- **User-visible text is Thai**, written directly in the component. There is no i18n framework, because no requirement names a second language. Error text is the exception: display the message the API returned, and fall back to `APP_ERRORS` from `@erp/contracts` only when the request never reached the API.
- **Never format a date or an amount inline.** Use `@/lib/format`, which owns TOR section 6.2's rules (Asia/Bangkok clock, two-decimal money): `formatTime` and `formatMoney` today, and add the next formatter there rather than in a component. Role names come from `ROLE_LABELS` in `@erp/contracts`, never the raw enum value.
- **Styling** with Tailwind utilities; merge class names with `cn()` from `@/lib/utils`.
- Tests are colocated `*.test.tsx` files. See the `write-tests` skill.
