<?php

namespace App\Services;

use App\Data\FamilyMemberData;
use App\Data\UserProfileData;

class ProfilePresenter
{
    public function __construct(
        private readonly FirebaseStorageService $storage,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function presentProfile(UserProfileData $profile): array
    {
        $data = $profile->toArray();
        $avatarUrl = $this->resolveAvatarUrl($profile);

        if ($avatarUrl !== null) {
            $data['avatarUrl'] = $avatarUrl;
        }

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    public function presentMember(FamilyMemberData $member): array
    {
        $data = $member->toArray();
        $avatarUrl = $this->resolveMemberAvatarUrl($member);

        if ($avatarUrl !== null) {
            $data['avatarUrl'] = $avatarUrl;
        }

        return $data;
    }

    private function resolveAvatarUrl(UserProfileData $profile): ?string
    {
        if ($profile->avatarType !== 'image' || $profile->avatarValue === '') {
            return null;
        }

        return $this->storage->signedUrlForProfileAvatar($profile->uid, $profile->avatarValue);
    }

    private function resolveMemberAvatarUrl(FamilyMemberData $member): ?string
    {
        if ($member->avatarType !== 'image' || $member->avatarValue === '') {
            return null;
        }

        return $this->storage->signedUrlForProfileAvatar($member->userId, $member->avatarValue);
    }
}
