<?php

namespace App\Services;

use App\Data\UserProfileData;
use App\Exceptions\ProfileServiceException;
use Google\Cloud\Core\Timestamp;
use Google\Cloud\Firestore\DocumentSnapshot;
use Throwable;

class UserProfileService
{
    private const COLLECTION = 'users';

    public function __construct(
        private readonly FirestoreService $firestore,
    ) {}

    public function findByUid(string $uid): ?UserProfileData
    {
        try {
            $snapshot = $this->documentReference($uid)->snapshot();

            if (! $snapshot->exists()) {
                return null;
            }

            return $this->mapSnapshot($uid, $snapshot);
        } catch (Throwable) {
            throw new ProfileServiceException('Failed to fetch user profile.');
        }
    }

    /**
     * @param  array{displayName: string, avatarType: string, avatarValue: string}  $payload
     */
    public function upsert(string $uid, string $email, array $payload): array
    {
        try {
            $reference = $this->documentReference($uid);
            $snapshot = $reference->snapshot();
            $now = new Timestamp(new \DateTimeImmutable);

            $createdAt = $snapshot->exists()
                ? ($snapshot->get('createdAt') ?? $now)
                : $now;

            $reference->set([
                'uid' => $uid,
                'email' => $email,
                'displayName' => $payload['displayName'],
                'avatarType' => $payload['avatarType'],
                'avatarValue' => $payload['avatarValue'],
                'createdAt' => $createdAt,
                'updatedAt' => $now,
            ]);

            $profile = $this->mapSnapshot($uid, $reference->snapshot());

            return [
                'profile' => $profile,
                'created' => ! $snapshot->exists(),
            ];
        } catch (ProfileServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new ProfileServiceException('Failed to save user profile.');
        }
    }

    private function documentReference(string $uid): \Google\Cloud\Firestore\DocumentReference
    {
        if (! $this->firestore->isConfigured()) {
            throw new ProfileServiceException('Firestore is not configured.');
        }

        return $this->firestore->getClient()
            ->collection(self::COLLECTION)
            ->document($uid);
    }

    private function mapSnapshot(string $uid, DocumentSnapshot $snapshot): UserProfileData
    {
        /** @var array<string, mixed> $data */
        $data = $snapshot->data() ?? [];

        return UserProfileData::fromFirestore($uid, $data);
    }
}
