<?php

namespace App\Data;

readonly class FamilyMemberData
{
    public function __construct(
        public string $userId,
        public string $displayName,
        public string $email,
        public string $avatarType,
        public string $avatarValue,
        public ?string $profileImage,
        public string $role,
        public string $joinedAt,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'userId' => $this->userId,
            'displayName' => $this->displayName,
            'email' => $this->email,
            'avatarType' => $this->avatarType,
            'avatarValue' => $this->avatarValue,
            'profileImage' => $this->profileImage,
            'role' => $this->role,
            'joinedAt' => $this->joinedAt,
        ];
    }
}
