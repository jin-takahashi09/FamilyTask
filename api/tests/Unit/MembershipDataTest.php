<?php

namespace Tests\Unit;

use App\Data\MembershipData;
use Tests\TestCase;

class MembershipDataTest extends TestCase
{
    public function test_from_firestore_reads_avatar_reference(): void
    {
        $membership = MembershipData::fromFirestore('family-1_user-1', [
            'familyId' => 'family-1',
            'userId' => 'user-1',
            'role' => 'member',
            'joinedAt' => '2026-08-06T00:00:00+00:00',
            'avatarType' => 'image',
            'avatarValue' => 'profile-images/user-1/avatar.webp',
        ]);

        $this->assertSame('image', $membership->avatarType);
        $this->assertSame('profile-images/user-1/avatar.webp', $membership->avatarValue);
    }

    public function test_from_firestore_defaults_missing_avatar_fields(): void
    {
        $membership = MembershipData::fromFirestore('family-1_user-1', [
            'familyId' => 'family-1',
            'userId' => 'user-1',
            'role' => 'owner',
            'joinedAt' => '2026-08-06T00:00:00+00:00',
        ]);

        $this->assertSame('none', $membership->avatarType);
        $this->assertSame('', $membership->avatarValue);
    }
}
