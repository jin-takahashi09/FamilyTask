<?php

namespace App\Services;

use App\Data\FamilyData;
use App\Data\FamilyMemberData;
use App\Data\MembershipData;
use App\Data\UserProfileData;
use App\Exceptions\FamilyServiceException;
use App\Exceptions\ProfileServiceException;
use App\Sync\FamilySyncEventType;
use Google\Cloud\Core\Timestamp;
use Google\Cloud\Firestore\DocumentReference;
use Google\Cloud\Firestore\DocumentSnapshot;
use Google\Cloud\Firestore\FirestoreClient;
use Google\Cloud\Firestore\Transaction;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class FamilyService
{
    private const COLLECTION = 'families';

    /** Firestore batch write limit is 500; keep headroom for retries. */
    private const BATCH_WRITE_LIMIT = 450;

    public function __construct(
        private readonly FirestoreService $firestore,
        private readonly MembershipService $memberships,
        private readonly UserProfileService $profiles,
        private readonly InviteCodeGenerator $inviteCodes,
        private readonly FamilySyncBroadcaster $sync,
    ) {}

    /**
     * @return list<FamilyData>
     */
    public function listForUser(string $userId): array
    {
        $userMemberships = $this->memberships->listByUserId($userId);
        $families = [];

        foreach ($userMemberships as $membership) {
            $family = $this->findById($membership->familyId);

            if ($family === null) {
                continue;
            }

            $families[] = new FamilyData(
                id: $family->id,
                name: $family->name,
                inviteCode: $family->inviteCode,
                ownerId: $family->ownerId,
                createdAt: $family->createdAt,
                updatedAt: $family->updatedAt,
                role: $membership->role,
                joinedAt: $membership->joinedAt,
            );
        }

        return $families;
    }

    public function create(string $userId, string $name): FamilyData
    {
        try {
            $client = $this->client();
            $familyId = (string) Str::uuid();
            $inviteCode = $this->inviteCodes->generateUnique($client);
            $now = new Timestamp(new \DateTimeImmutable);
            $membershipId = MembershipService::documentId($familyId, $userId);

            $familyRef = $client->collection(self::COLLECTION)->document($familyId);
            $membershipRef = $client->collection('memberships')->document($membershipId);

            $avatarFields = $this->avatarFieldsForUser($userId);

            $client->runTransaction(function (Transaction $transaction) use (
                $familyRef,
                $membershipRef,
                $familyId,
                $userId,
                $name,
                $inviteCode,
                $now,
                $membershipId,
                $avatarFields,
            ): void {
                $familySnapshot = $transaction->snapshot($familyRef);
                if ($familySnapshot->exists()) {
                    throw new FamilyServiceException('グループを作成できませんでした', 503);
                }

                $membershipSnapshot = $transaction->snapshot($membershipRef);
                if ($membershipSnapshot->exists()) {
                    throw new FamilyServiceException('グループを作成できませんでした', 503);
                }

                $transaction->set($familyRef, [
                    'id' => $familyId,
                    'name' => $name,
                    'inviteCode' => $inviteCode,
                    'ownerId' => $userId,
                    'createdAt' => $now,
                    'updatedAt' => $now,
                ]);

                $transaction->set($membershipRef, [
                    'id' => $membershipId,
                    'familyId' => $familyId,
                    'userId' => $userId,
                    'role' => 'owner',
                    'joinedAt' => $now,
                    'avatarType' => $avatarFields['avatarType'],
                    'avatarValue' => $avatarFields['avatarValue'],
                ]);
            });

            $family = $this->findById($familyId);

            if ($family === null) {
                throw new FamilyServiceException('グループを作成できませんでした');
            }

            $this->sync->dispatch($familyId, FamilySyncEventType::FamilyCreated, $now->get());

            return new FamilyData(
                id: $family->id,
                name: $family->name,
                inviteCode: $family->inviteCode,
                ownerId: $family->ownerId,
                createdAt: $family->createdAt,
                updatedAt: $family->updatedAt,
                role: 'owner',
            );
        } catch (FamilyServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new FamilyServiceException('グループを作成できませんでした');
        }
    }

    public function findById(string $familyId): ?FamilyData
    {
        try {
            $snapshot = $this->familyReference($familyId)->snapshot();

            if (! $snapshot->exists()) {
                return null;
            }

            return $this->mapFamilySnapshot($snapshot);
        } catch (FamilyServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new FamilyServiceException('グループ情報を取得できませんでした');
        }
    }

    public function getForMember(string $userId, string $familyId): FamilyData
    {
        $membership = $this->memberships->requireMembership($userId, $familyId);
        $family = $this->findById($familyId);

        if ($family === null) {
            throw new FamilyServiceException('グループが見つかりません', 404);
        }

        return new FamilyData(
            id: $family->id,
            name: $family->name,
            inviteCode: $family->inviteCode,
            ownerId: $family->ownerId,
            createdAt: $family->createdAt,
            updatedAt: $family->updatedAt,
            role: $membership->role,
        );
    }

    public function join(string $userId, string $inviteCode): FamilyData
    {
        $normalizedCode = strtoupper(trim($inviteCode));
        $family = $this->findByInviteCode($normalizedCode);

        if ($family === null) {
            throw new FamilyServiceException('招待コードが正しくありません', 422);
        }

        $existing = $this->memberships->findByUserAndFamily($userId, $family->id);

        if ($existing !== null) {
            throw new FamilyServiceException('このグループには既に参加しています', 409);
        }

        try {
            $client = $this->client();
            $membershipId = MembershipService::documentId($family->id, $userId);
            $membershipRef = $client->collection('memberships')->document($membershipId);
            $now = new Timestamp(new \DateTimeImmutable);

            if ($membershipRef->snapshot()->exists()) {
                throw new FamilyServiceException('このグループには既に参加しています', 409);
            }

            $avatarFields = $this->avatarFieldsForUser($userId);

            $membershipRef->set([
                'id' => $membershipId,
                'familyId' => $family->id,
                'userId' => $userId,
                'role' => 'member',
                'joinedAt' => $now,
                'avatarType' => $avatarFields['avatarType'],
                'avatarValue' => $avatarFields['avatarValue'],
            ]);

            $this->sync->dispatch($family->id, FamilySyncEventType::FamilyJoined, $now->get());

            return new FamilyData(
                id: $family->id,
                name: $family->name,
                inviteCode: $family->inviteCode,
                ownerId: $family->ownerId,
                createdAt: $family->createdAt,
                updatedAt: $family->updatedAt,
                role: 'member',
            );
        } catch (FamilyServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new FamilyServiceException('グループへの参加に失敗しました');
        }
    }

    /**
     * @return list<FamilyMemberData>
     */
    public function listMembers(string $userId, string $familyId): array
    {
        $this->memberships->requireMembership($userId, $familyId);
        $memberships = $this->memberships->listByFamilyId($familyId);
        $members = [];

        foreach ($memberships as $membership) {
            $profile = $this->profiles->findByUid($membership->userId);
            $displayName = $profile?->displayName ?? '';
            $email = $profile?->email ?? '';
            [$avatarType, $avatarValue] = $this->resolveMemberAvatar($membership, $profile);
            $profileImage = null;

            if ($avatarType === 'initials' && $avatarValue !== '') {
                $profileImage = $avatarValue;
            }

            $members[] = new FamilyMemberData(
                userId: $membership->userId,
                displayName: $displayName,
                email: $email,
                avatarType: $avatarType,
                avatarValue: $avatarValue,
                profileImage: $profileImage,
                role: $membership->role,
                joinedAt: $membership->joinedAt,
            );
        }

        return $members;
    }

    public function leave(string $userId, string $familyId): void
    {
        $membership = $this->memberships->requireMembership($userId, $familyId);

        if ($membership->role === 'owner') {
            throw new FamilyServiceException(
                'オーナーは退出する前に、オーナー権限の移譲またはグループの削除を行ってください',
                403,
            );
        }

        try {
            $this->memberships->membershipReference($familyId, $userId)->delete();

            $this->sync->dispatch($familyId, FamilySyncEventType::FamilyLeft);
        } catch (FamilyServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new FamilyServiceException('グループから退出できませんでした');
        }
    }

    public function removeMember(string $ownerUserId, string $familyId, string $targetUserId): void
    {
        $this->memberships->requireOwner($ownerUserId, $familyId);

        if ($ownerUserId === $targetUserId) {
            throw new FamilyServiceException('自分自身は削除できません', 403);
        }

        $targetMembership = $this->memberships->findByUserAndFamily($targetUserId, $familyId);

        if ($targetMembership === null) {
            throw new FamilyServiceException('メンバーが見つかりません', 404);
        }

        try {
            $this->memberships->membershipReference($familyId, $targetUserId)->delete();

            $this->sync->dispatch($familyId, FamilySyncEventType::FamilyMemberRemoved);
        } catch (FamilyServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new FamilyServiceException('メンバーを削除できませんでした');
        }
    }

    public function transferOwnership(
        string $ownerUserId,
        string $familyId,
        string $targetUserId,
    ): FamilyData {
        $this->memberships->requireOwner($ownerUserId, $familyId);

        if ($ownerUserId === $targetUserId) {
            throw new FamilyServiceException('自分自身には移譲できません', 403);
        }

        $targetMembership = $this->memberships->findByUserAndFamily($targetUserId, $familyId);

        if ($targetMembership === null || $targetMembership->role !== 'member') {
            throw new FamilyServiceException('移譲先のメンバーが見つかりません', 404);
        }

        try {
            $client = $this->client();
            $familyRef = $this->familyReference($familyId);
            $ownerMembershipRef = $this->memberships->membershipReference($familyId, $ownerUserId);
            $targetMembershipRef = $this->memberships->membershipReference($familyId, $targetUserId);
            $now = new Timestamp(new \DateTimeImmutable);

            $client->runTransaction(function (Transaction $transaction) use (
                $familyRef,
                $ownerMembershipRef,
                $targetMembershipRef,
                $targetUserId,
                $now,
            ): void {
                $familySnapshot = $transaction->snapshot($familyRef);
                if (! $familySnapshot->exists()) {
                    throw new FamilyServiceException('グループが見つかりません', 404);
                }

                /** @var array<string, mixed> $familyData */
                $familyData = $familySnapshot->data() ?? [];

                $transaction->update($familyRef, [
                    ['path' => 'ownerId', 'value' => $targetUserId],
                    ['path' => 'updatedAt', 'value' => $now],
                ]);

                $transaction->update($ownerMembershipRef, [
                    ['path' => 'role', 'value' => 'member'],
                ]);

                $transaction->update($targetMembershipRef, [
                    ['path' => 'role', 'value' => 'owner'],
                ]);
            });

            $this->sync->dispatch($familyId, FamilySyncEventType::FamilyOwnershipTransferred, $now->get());

            return $this->getForMember($ownerUserId, $familyId);
        } catch (FamilyServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new FamilyServiceException('オーナー権限を移譲できませんでした');
        }
    }

    public function delete(string $ownerUserId, string $familyId, string $confirmName): void
    {
        $memberships = $this->memberships->listByFamilyId($familyId);
        $family = $this->findById($familyId);

        if ($family === null && $memberships === []) {
            return;
        }

        $this->memberships->requireOwner($ownerUserId, $familyId);

        if ($family !== null && $confirmName !== $family->name) {
            throw new FamilyServiceException('グループ名が一致しません。削除を中止しました', 422);
        }

        try {
            $this->deleteMembershipDocuments($familyId, $memberships);
            $this->deleteFamilyDocument($familyId);

            $this->sync->dispatch($familyId, FamilySyncEventType::FamilyDeleted);
        } catch (FamilyServiceException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Family delete failed', [
                'familyId' => $familyId,
                'membershipCount' => count($memberships),
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw new FamilyServiceException('グループを削除できませんでした');
        }
    }

    /**
     * @param  list<MembershipData>  $memberships
     */
    private function deleteMembershipDocuments(string $familyId, array $memberships): void
    {
        if ($memberships === []) {
            return;
        }

        $client = $this->client();
        $refs = [];

        foreach ($memberships as $membership) {
            if ($membership->familyId !== $familyId) {
                continue;
            }

            $refs[] = $client->collection('memberships')->document($membership->id);
        }

        foreach (array_chunk($refs, self::BATCH_WRITE_LIMIT) as $chunk) {
            $this->commitBatchDeletes($client, $chunk);
        }
    }

    private function deleteFamilyDocument(string $familyId): void
    {
        $ref = $this->familyReference($familyId);

        try {
            if ($ref->snapshot()->exists()) {
                $ref->delete();
            }
        } catch (FamilyServiceException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Family document delete failed', [
                'familyId' => $familyId,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * @param  list<DocumentReference>  $refs
     */
    private function commitBatchDeletes(FirestoreClient $client, array $refs): void
    {
        if ($refs === []) {
            return;
        }

        try {
            $batch = $client->bulkWriter();

            foreach ($refs as $ref) {
                $batch->delete($ref);
            }

            $batch->commit();

            return;
        } catch (Throwable $batchError) {
            Log::warning('Family delete batch failed; falling back to individual deletes', [
                'documentCount' => count($refs),
                'exceptionClass' => $batchError::class,
                'exceptionMessage' => $batchError->getMessage(),
            ]);
        }

        foreach ($refs as $ref) {
            try {
                if ($ref->snapshot()->exists()) {
                    $ref->delete();
                }
            } catch (Throwable $e) {
                Log::error('Family delete individual document failed', [
                    'documentPath' => $ref->path(),
                    'exceptionClass' => $e::class,
                    'exceptionMessage' => $e->getMessage(),
                ]);

                throw $e;
            }
        }
    }

    public function regenerateInviteCode(string $ownerUserId, string $familyId): FamilyData
    {
        $this->memberships->requireOwner($ownerUserId, $familyId);

        try {
            $client = $this->client();
            $familyRef = $this->familyReference($familyId);
            $newCode = $this->inviteCodes->generateUnique($client);
            $now = new Timestamp(new \DateTimeImmutable);

            $familyRef->update([
                ['path' => 'inviteCode', 'value' => $newCode],
                ['path' => 'updatedAt', 'value' => $now],
            ]);

            $family = $this->getForMember($ownerUserId, $familyId);

            return $family;
        } catch (FamilyServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new FamilyServiceException('招待コードを再発行できませんでした');
        }
    }

    private function findByInviteCode(string $inviteCode): ?FamilyData
    {
        try {
            $client = $this->client();

            foreach (
                $client->collection(self::COLLECTION)
                    ->where('inviteCode', '=', $inviteCode)
                    ->limit(1)
                    ->documents() as $document
            ) {
                if ($document->exists()) {
                    return $this->mapFamilySnapshot($document);
                }
            }

            return null;
        } catch (FamilyServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new FamilyServiceException('招待コードが正しくありません', 422);
        }
    }

    private function familyReference(string $familyId): \Google\Cloud\Firestore\DocumentReference
    {
        return $this->client()
            ->collection(self::COLLECTION)
            ->document($familyId);
    }

    private function client(): FirestoreClient
    {
        if (! $this->firestore->isConfigured()) {
            throw new FamilyServiceException('Firestore is not configured.');
        }

        return $this->firestore->getClient();
    }

    private function mapFamilySnapshot(DocumentSnapshot $snapshot): FamilyData
    {
        /** @var array<string, mixed> $data */
        $data = $snapshot->data() ?? [];

        return FamilyData::fromFirestore($snapshot->id(), $data);
    }

    /**
     * @return array{avatarType: string, avatarValue: string}
     */
    private function avatarFieldsForUser(string $userId): array
    {
        try {
            $profile = $this->profiles->findByUid($userId);
        } catch (ProfileServiceException) {
            $profile = null;
        }

        return [
            'avatarType' => $profile?->avatarType ?? 'none',
            'avatarValue' => $profile?->avatarValue ?? '',
        ];
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function resolveMemberAvatar(MembershipData $membership, ?UserProfileData $profile): array
    {
        if ($profile !== null && $profile->avatarType === 'image' && $profile->avatarValue !== '') {
            return [$profile->avatarType, $profile->avatarValue];
        }

        if ($membership->avatarType === 'image' && $membership->avatarValue !== '') {
            return [$membership->avatarType, $membership->avatarValue];
        }

        if ($membership->avatarType !== 'none' || $membership->avatarValue !== '') {
            return [$membership->avatarType, $membership->avatarValue];
        }

        return [
            $profile?->avatarType ?? 'none',
            $profile?->avatarValue ?? '',
        ];
    }
}
