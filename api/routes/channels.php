<?php

use App\Services\MembershipService;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Family-scoped private channels. Authorization uses the Firebase UID set
| by VerifyFirebaseToken middleware — never trust client-supplied UIDs.
|
*/

Broadcast::channel('family.{familyId}', function (object $user, string $familyId): bool {
    $uid = $user->id ?? null;

    if (! is_string($uid) || $uid === '') {
        return false;
    }

    return app(MembershipService::class)->isMember($uid, $familyId);
});

/*
| User-scoped private channel for in-app notifications.
| Only the authenticated Firebase UID may subscribe to their own channel.
*/
Broadcast::channel('user.{userId}', function (object $user, string $userId): bool {
    $uid = $user->id ?? null;

    if (! is_string($uid) || $uid === '') {
        return false;
    }

    return $uid === $userId;
});
