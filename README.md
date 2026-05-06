# Postfolio

A freelancer workflow and billing platform built with the MERN stack.
Manage clients, projects, milestones, deliverables, and invoices.
Clients get a read-only portal — no account required.
Payments via Razorpay with real-time dashboard updates via Socket.io.

**Live Demo:** [postfolio.vercel.app](https://postfolio.vercel.app)  
**Backend API:** [your-railway-url.up.railway.app/health](https://your-railway-url.up.railway.app/health)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui, React Query |
| Backend | Node.js 20, Express.js 4 |
| Database | MongoDB Atlas, Mongoose |
| Real-time | Socket.io |
| Cache | Redis (ioredis) |
| Payments | Razorpay |
| PDF | PDFKit |
| Storage | Cloudinary |
| Email | Nodemailer |
| Auth | JWT (dual-token with refresh rotation) |
| Logging | Pino |
| Testing | Jest, Supertest |
| Deployment | Vercel (frontend), Railway (backend + Redis) |

---

## Key Engineering Decisions

**Dual-token JWT with refresh rotation**  
Access tokens (15 min) stored in memory. Refresh tokens (7 days) in httpOnly cookies.
Each refresh token use issues a new one and invalidates the old — prevents replay attacks.

**Compound partial index for soft deletes**  
Clients are soft-archived, not deleted. A compound partial index
`{ workspace: 1, email: 1 }` with `partialFilterExpression: { isArchived: false }`
enforces email uniqueness only among active clients.
Archiving a client does not block re-adding that email.

**Project state machine**  
Projects move through `draft → active → on_hold → completed`.
Invalid transitions (e.g. `cancelled → active`) are rejected at the service layer
with a 409. The state machine is a plain object — no library needed.

**Invoice edit lock**  
Once an invoice moves from `draft` to `sent`, it is immutable.
The service layer throws `409 INVOICE_NOT_EDITABLE` on any edit attempt.
Corrections require cancel-and-reissue — consistent with GST compliance.

**Atomic invoice numbering**  
Invoice numbers are generated via MongoDB `$inc` — a single atomic operation.
No read-then-write pattern. Concurrent requests always receive unique numbers.

**Three-layer payment protection**  
1. Edit lock: invoice immutable after send  
2. Amount reconciliation: webhook amount must match invoice total ±₹0.01  
3. Idempotency store: duplicate webhook events detected via `ProcessedEvent` collection with TTL index

**Workspace-scoped multi-tenancy**  
Every collection (except User and Workspace) is scoped to a `workspace` ObjectId.
`workspaceScope` middleware injects this on every protected request.
Broken object-level auth is structurally impossible — a query without the workspace filter
returns nothing.

**Redis for rate limiting and caching**  
Redis is used for two justified purposes only: rate limiting login attempts
(Redis-backed counters work across multiple server instances)
and caching dashboard aggregation results (5-minute TTL, invalidated on invoice writes).
Redis unavailability degrades gracefully — the app continues to function.

**HMAC portal tokens**  
Client portal URLs contain a signed HMAC-SHA256 token encoding workspaceId,
projectId, and expiry. No login required. Tokens are revocable instantly —
the server compares the incoming token against the stored one on every request.

---

## Architecture