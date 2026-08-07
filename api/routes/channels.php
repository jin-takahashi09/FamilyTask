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
