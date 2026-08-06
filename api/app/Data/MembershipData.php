<?php

namespace App\Data;

readonly class MembershipData
{
    public function __construct(
        public string $id,
        public string $familyId,
        public string $userId,
        public string $role,
        public string $joinedAt,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromFirestore(string $id, array $data): self
    {
        return new self(
            id: $id,
            familyId: (string) ($data['familyId'] ?? ''),
            userId: (string) ($data['userId'] ?? ''),
            role: (string) ($data['role'] ?? 'member'),
            joinedAt: FirestoreTimestamps::toIso8601($data['joinedAt'] ?? null),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'familyId' => $this->familyId,
            'userId' => $this->userId,
            'role' => $this->role,
            'joinedAt' => $this->joinedAt,
        ];
    }
}
