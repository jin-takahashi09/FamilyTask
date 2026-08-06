<?php

namespace App\Data;

readonly class UserProfileData
{
    public function __construct(
        public string $uid,
        public string $email,
        public string $displayName,
        public string $avatarType,
        public string $avatarValue,
        public string $createdAt,
        public string $updatedAt,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromFirestore(string $uid, array $data): self
    {
        return new self(
            uid: $uid,
            email: (string) ($data['email'] ?? ''),
            displayName: (string) ($data['displayName'] ?? ''),
            avatarType: (string) ($data['avatarType'] ?? 'none'),
            avatarValue: (string) ($data['avatarValue'] ?? ''),
            createdAt: self::timestampToIso8601($data['createdAt'] ?? null),
            updatedAt: self::timestampToIso8601($data['updatedAt'] ?? null),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'uid' => $this->uid,
            'email' => $this->email,
            'displayName' => $this->displayName,
            'avatarType' => $this->avatarType,
            'avatarValue' => $this->avatarValue,
            'createdAt' => $this->createdAt,
            'updatedAt' => $this->updatedAt,
        ];
    }

    private static function timestampToIso8601(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format(\DateTimeInterface::ATOM);
        }

        if (is_object($value) && method_exists($value, 'get')) {
            /** @var \DateTimeInterface|null $dateTime */
            $dateTime = $value->get();

            if ($dateTime instanceof \DateTimeInterface) {
                return $dateTime->format(\DateTimeInterface::ATOM);
            }
        }

        if (is_string($value) && $value !== '') {
            return $value;
        }

        return now()->toIso8601String();
    }
}
