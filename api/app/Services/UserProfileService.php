<?php

namespace App\Services;

use App\Data\UserProfileData;
use App\Exceptions\ProfileServiceException;
use App\Sync\FamilySyncEventType;
use Google\Cloud\Core\Timestamp;
use Google\Cloud\Firestore\DocumentSnapshot;
use Illuminate\Support\Facades\Log;
use Throwable;

class UserProfileService
{
    private const COLLECTION = 'users';

    public function __construct(
        private readonly FirestoreService $firestore,
        private readonly FamilySyncBroadcaster $sync,
        private readonly MembershipService $memberships,
    ) {}

    public function findByUid(string $uid): ?UserProfileData
    {
        try {
            return FirestoreRetry::run(function () use ($uid): ?UserProfileData {
                $snapshot = $this->documentReference($uid)->snapshot();

                if (! $snapshot->exists()) {
                    return null;
                }

                return $this->mapSnapshot($uid, $snapshot);
            }, $this->firestore);
        } catch (ProfileServiceException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Profile lookup failed', [
                'uid' => $uid,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw new ProfileServiceException('Failed to fetch user profile.');
        }
    }

    /**
     * @param  array{displayName: string, avatarType: string, avatarValue: string}  $payload
     */
    public function upsert(string $uid, string $email, array $payload): array
    {
        try {
            $result = FirestoreRetry::run(function () use ($uid, $email, $payload): array {
                $reference = $this->documentReference($uid);
                $snapshot = $reference->snapshot();
                $now = new Timestamp(new \DateTimeImmutable);

                $createdAt = $snapshot->exists()
                    ? ($snapshot->get('createdAt') ?? $now)
                    : $now;

                $avatarType = $payload['avatarType'];
                $avatarValue = $payload['avatarValue'];

                if ($snapshot->exists()) {
                    $existingAvatarType = (string) ($snapshot->get('avatarType') ?? 'none');
                    $existingAvatarValue = (string) ($snapshot->get('avatarValue') ?? '');

                    if (
                        $avatarType === 'none'
                        && $avatarValue === ''
                        && $existingAvatarType === 'image'
                        && $existingAvatarValue !== ''
                    ) {
                        $avatarType = $existingAvatarType;
                        $avatarValue = $existingAvatarValue;
                    }
                }

                $reference->set([
                    'uid' => $uid,
                    'email' => $email,
                    'displayName' => $payload['displayName'],
                    'avatarType' => $avatarType,
                    'avatarValue' => $avatarValue,
                    'createdAt' => $createdAt,
                    'updatedAt' => $now,
                ]);

                $profile = $this->mapSnapshot($uid, $reference->snapshot());

                $this->sync->dispatchForUserMemberships(
                    $uid,
                    FamilySyncEventType::ProfileUpdated,
                    $now->get(),
                );

                return [
                    'profile' => $profile,
                    'created' => ! $snapshot->exists(),
                ];
            }, $this->firestore);

            $this->memberships->syncAvatarForUser(
                $uid,
                $result['profile']->avatarType,
                $result['profile']->avatarValue,
            );

            return $result;
        } catch (ProfileServiceException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Profile upsert failed', [
                'uid' => $uid,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw new ProfileServiceException('Failed to save user profile.');
        }
    }

    public function updateAvatar(string $uid, string $email, string $storagePath): array
    {
        try {
            $result = FirestoreRetry::run(function () use ($uid, $email, $storagePath): array {
                $reference = $this->documentReference($uid);
                $snapshot = $reference->snapshot();
                $now = new Timestamp(new \DateTimeImmutable);

                if (! $snapshot->exists()) {
                    throw new ProfileServiceException('Profile must exist before uploading an avatar.');
                }

                $createdAt = $snapshot->get('createdAt') ?? $now;

                $reference->set([
                    'uid' => $uid,
                    'email' => $email !== '' ? $email : (string) ($snapshot->get('email') ?? ''),
                    'displayName' => (string) ($snapshot->get('displayName') ?? ''),
                    'avatarType' => 'image',
                    'avatarValue' => $storagePath,
                    'createdAt' => $createdAt,
                    'updatedAt' => $now,
                ]);

                $profile = $this->mapSnapshot($uid, $reference->snapshot());

                $this->sync->dispatchForUserMemberships(
                    $uid,
                    FamilySyncEventType::ProfileUpdated,
                    $now->get(),
                );

                return [
                    'profile' => $profile,
                    'created' => false,
                ];
            }, $this->firestore);

            $this->memberships->syncAvatarForUser(
                $uid,
                $result['profile']->avatarType,
                $result['profile']->avatarValue,
            );

            return $result;
        } catch (ProfileServiceException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Profile avatar update failed', [
                'uid' => $uid,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw new ProfileServiceException('Failed to save profile avatar.');
        }
    }

    public function clearAvatar(string $uid): array
    {
        try {
            $result = FirestoreRetry::run(function () use ($uid): array {
                $reference = $this->documentReference($uid);
                $snapshot = $reference->snapshot();
                $now = new Timestamp(new \DateTimeImmutable);

                if (! $snapshot->exists()) {
                    throw new ProfileServiceException('Profile not found.');
                }

                $createdAt = $snapshot->get('createdAt') ?? $now;

                $reference->set([
                    'uid' => $uid,
                    'email' => (string) ($snapshot->get('email') ?? ''),
                    'displayName' => (string) ($snapshot->get('displayName') ?? ''),
                    'avatarType' => 'none',
                    'avatarValue' => '',
                    'createdAt' => $createdAt,
                    'updatedAt' => $now,
                ]);

                $profile = $this->mapSnapshot($uid, $reference->snapshot());

                $this->sync->dispatchForUserMemberships(
                    $uid,
                    FamilySyncEventType::ProfileUpdated,
                    $now->get(),
                );

                return [
                    'profile' => $profile,
                    'created' => false,
                ];
            }, $this->firestore);

            $this->memberships->syncAvatarForUser(
                $uid,
                $result['profile']->avatarType,
                $result['profile']->avatarValue,
            );

            return $result;
        } catch (ProfileServiceException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Profile avatar clear failed', [
                'uid' => $uid,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw new ProfileServiceException('Failed to remove profile avatar.');
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
