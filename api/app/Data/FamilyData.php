<?php

namespace App\Data;

readonly class FamilyData
{
    public function __construct(
        public string $id,
        public string $name,
        public string $inviteCode,
        public string $ownerId,
        public string $createdAt,
        public string $updatedAt,
        public ?string $role = null,
        public ?string $joinedAt = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromFirestore(string $id, array $data, ?string $role = null, ?string $joinedAt = null): self
    {
        return new self(
            id: $id,
            name: (string) ($data['name'] ?? ''),
            inviteCode: (string) ($data['inviteCode'] ?? ''),
            ownerId: (string) ($data['ownerId'] ?? ''),
            createdAt: FirestoreTimestamps::toIso8601($data['createdAt'] ?? null),
            updatedAt: FirestoreTimestamps::toIso8601($data['updatedAt'] ?? null),
            role: $role,
            joinedAt: $joinedAt,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $payload = [
            'id' => $this->id,
            'name' => $this->name,
            'inviteCode' => $this->inviteCode,
            'ownerId' => $this->ownerId,
            'createdAt' => $this->createdAt,
            'updatedAt' => $this->updatedAt,
        ];

        if ($this->role !== null) {
            $payload['role'] = $this->role;
        }

        if ($this->joinedAt !== null) {
            $payload['joinedAt'] = $this->joinedAt;
        }

        return $payload;
    }
}
