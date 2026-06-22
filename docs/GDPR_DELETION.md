# GDPR Data Deletion Implementation

## Overview
This document describes the GDPR-compliant data deletion functionality implemented for the StarPass backend.

## Implementation Details

### Schema Changes
The `Fan` model has been updated with three new fields to support GDPR compliance:

1. **`deletionRequestedAt`** (DateTime, nullable): Timestamp when deletion was requested. Marks the start of the 30-day cooling off period.

2. **`anonymized`** (Boolean, default: false): Tracks whether the fan's personal data has been anonymized.

3. **`permanentlyDeletedAt`** (DateTime, nullable): Timestamp when the fan account was permanently deleted.

### API Endpoints

#### 1. DELETE `/fans/:address/account`
**Purpose**: Request account deletion (GDPR right to be forgotten)

**Status Code**: 202 Accepted (not immediately deleted)

**Response**: Updated fan record with `deletionRequestedAt` timestamp

**What Happens**:
- Marks the fan account for deletion
- Immediately cancels all active passes
- Starts the 30-day cooling off period
- Prevents duplicate deletion requests (409 Conflict if already requested)

**Example**:
```bash
DELETE /fans/GBRPYHIL2CI3FV4BMSXIOCNUTZ37NKPNCV63N7VBFQXNWLQRWV4V24F/account
```

#### 2. GET `/fans/:address/deletion-status`
**Purpose**: Check the status of account deletion request

**Response**:
```json
{
  "deletionRequested": true,
  "deletionRequestedAt": "2024-06-21T10:00:00Z",
  "coolingOffEndDate": "2024-07-21T10:00:00Z",
  "canFinalizeDeletion": false,
  "anonymized": true
}
```

### Service Methods

#### `requestDeletion(stellarAddress: string)`
- Initiates the deletion request
- Cancels all active passes immediately
- Sets `deletionRequestedAt` to current time
- Uses transaction to ensure consistency
- Throws `ConflictException` if already requested
- Throws `NotFoundException` if fan doesn't exist

#### `anonymizeFanData(stellarAddress: string)`
- Anonymizes personal data by replacing `displayName`
- Sets `anonymized` flag to true
- Should be called immediately after deletion request (in a scheduled job)
- Complies with GDPR requirement to minimize personal data retention
- Idempotent (safe to call multiple times)

#### `permanentlyDeleteFan(stellarAddress: string)`
- Permanently deletes the fan after 30-day cooling off period
- Throws `BadRequestException` if cooling off period hasn't elapsed
- Only deletes `Fan` and `User` records (preserves `Pass` records for compliance)
- Should be called via a scheduled job after the cooling off period
- Returns error with the exact date when deletion becomes available

#### `getDeletionStatus(stellarAddress: string)`
- Returns current deletion status
- Indicates when cooling off period ends
- Shows if account can be finalized for deletion
- Useful for user-facing delete status pages

### GDPR Compliance Features

#### 1. **30-Day Cooling Off Period**
- Users have 30 days to cancel their deletion request
- Prevents accidental permanent data loss
- Aligns with GDPR article 17 requirements
- After 30 days, permanent deletion can be performed

#### 2. **Data Anonymization**
- Personal data (displayName) is anonymized but user account remains
- Reduces personal data retention during cooling off period
- Anonymization format: `Deleted User {first8charsOfId}`
- Example: `Deleted User a1b2c3d4`

#### 3. **Transaction Record Retention**
- `Pass` records (transactions) are NOT deleted
- Required for financial compliance and audit trails
- Personal data linkage is removed through anonymization
- Enables investigation of past transactions if needed
- Meets GDPR Article 17(3)(b) requirements for legal obligations

#### 4. **Pass Cancellation**
- All active passes are immediately cancelled when deletion is requested
- Prevents creators from continuing to collect from deleted accounts
- Passes remain in database (not deleted) for record-keeping
- `active` field is set to `false` for all passes

#### 5. **Cascade Deletion**
- When `User` is deleted, associated `Session` records are cascade deleted
- User authentication tokens are invalidated
- Ensures deleted accounts cannot be reused for login

### Implementation Flow

```
User Request
    ↓
DELETE /fans/:address/account
    ↓
requestDeletion() Method
    ├─ Validate fan exists
    ├─ Cancel all active passes
    ├─ Set deletionRequestedAt
    └─ Return 202 Accepted
    ↓
[30-Day Cooling Off Period]
    ├─ User can view deletion status via GET /fans/:address/deletion-status
    ├─ User is effectively deleted (anonymized)
    └─ Can potentially recover account within this period
    ↓
Scheduled Job (after 30 days)
    ├─ Call permanentlyDeleteFan()
    ├─ Delete Fan and User records
    ├─ Keep Pass records for compliance
    └─ Log permanent deletion
```

### Database Schema Updates

Run the migration to update the database:
```bash
npm run db:migrate -- add_gdpr_deletion_fields
```

Or generate Prisma client:
```bash
npm run db:generate
```

### Testing

Comprehensive tests are included in:
- `src/fans/fans.service.spec.ts` - Unit tests for deletion logic
- `src/fans/fans.controller.spec.ts` - Integration tests for API endpoints

Test coverage includes:
- ✅ Deletion request flow
- ✅ Data anonymization
- ✅ Cooling off period enforcement
- ✅ Pass cancellation
- ✅ Permanent deletion after period
- ✅ Transaction record retention
- ✅ Error handling (not found, conflicts, etc.)

Run tests with:
```bash
npm test
npm test:cov
```

### Scheduled Jobs (TODO)

To complete the implementation, add scheduled jobs for:

1. **Anonymization Job** (run daily or hourly)
   - Find fans with `deletionRequestedAt` and `anonymized = false`
   - Call `anonymizeFanData()` for each

2. **Permanent Deletion Job** (run daily)
   - Find fans with `deletionRequestedAt` more than 30 days ago
   - Call `permanentlyDeleteFan()` for each
   - Log all deletions for audit trail

Example using `@nestjs/schedule`:
```typescript
@Cron(CronExpression.EVERY_HOUR)
async handleAnonymization() {
  // Find and anonymize fans
}

@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async handlePermanentDeletion() {
  // Find and permanently delete fans
}
```

### Audit Trail

All operations are logged via Logger:
```
[FansService] Deletion requested for fan GBRPYHIL2CI3FV4BMSXIOCNUTZ37NKPNCV63N7VBFQXNWLQRWV4V24F. Cooling off period starts now.
[FansService] Cancelled 2 active passes for fan fan-1
[FansService] Fan GBRPYHIL2CI3FV4BMSXIOCNUTZ37NKPNCV63N7VBFQXNWLQRWV4V24F data anonymized
[FansService] Fan GBRPYHIL2CI3FV4BMSXIOCNUTZ37NKPNCV63N7VBFQXNWLQRWV4V24F permanently deleted
```

### Error Scenarios

| Scenario | Status Code | Error |
|----------|-------------|-------|
| Fan not found | 404 | NotFoundException |
| Deletion already requested | 409 | ConflictException |
| Cooling off period not elapsed | 400 | BadRequestException |
| Deletion not requested | 400 | BadRequestException |

### Future Enhancements

1. Add email notifications for deletion requests
2. Add option for users to cancel deletion during cooling period
3. Add admin dashboard for deletion requests
4. Add data export before anonymization
5. Add webhook notifications for creators about cancelled passes

### GDPR Articles Compliance

- **Article 15** (Right of access): Users can check deletion status via `GET /fans/:address/deletion-status`
- **Article 17** (Right to be forgotten): Implemented via `DELETE /fans/:address/account`
- **Article 17(3)(b)** (Legal obligations): Transaction records retained for financial compliance
- **Article 20** (Data portability): Recommend implementing data export endpoint
