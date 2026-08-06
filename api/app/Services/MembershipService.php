<?php

namespace App\Services;

use App\Data\MembershipData;
use App\Exceptions\FamilyServiceException;
use Google\Cloud\Firestore\DocumentSnapshot;
use Google\Cloud\Firestore\FirestoreClient;
use Throwable;

class MembershipService
{
    private const COLLECTION = 'memberships';

    public function __construct(
        private readonly FirestoreService $firestore,
    ) {}

    public static function documentId(string $familyId, string $userId): string
    {
        return $familyId.'_'.$userId;
    }

    public function findByUserAndFamily(string $userId, string $familyId): ?MembershipData
    {
        try {
            $snapshot = $this->membershipReference($familyId, $userId)->snapshot();

            if (! $snapshot->exists()) {
                return null;
            }

            return $this->mapSnapshot($snapshot);
        } catch (FamilyServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new FamilyServiceException('メンバー情報を取得できませんでした');
        }
    }

    /**
     * @return list<MembershipData>
     */
    public function listByUserId(string $userId): array
    {
        try {
            $client = $this->client();
            $memberships = [];

            foreach (
                $client->collection(self::COLLECTION)
                    ->where('userId', '=', $userId)
                    ->documents() as $document
            ) {
                if ($document->exists()) {
                    $memberships[] = $this->mapSnapshot($document);
                }
            }

            return $memberships;
        } catch (FamilyServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new FamilyServiceException('所属グループを取得できませんでした');
        }
    }

    /**
     * @return list<MembershipData>
     */
    public function listByFamilyId(string $familyId): array
    {
        try {
            $client = $this->client();
            $memberships = [];

            foreach (
                $client->collection(self::COLLECTION)
                    ->where('familyId', '=', $familyId)
                    ->documents() as $document
            ) {
                if ($document->exists()) {
                    $memberships[] = $this->mapSnapshot($document);
                }
            }

            return $memberships;
        } catch (FamilyServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new FamilyServiceException('メンバー一覧を取得できませんでした');
        }
    }

    public function isMember(string $userId, string $familyId): bool
    {
        return $this->findByUserAndFamily($userId, $familyId) !== null;
    }

    public function isOwner(string $userId, string $familyId): bool
    {
        $membership = $this->findByUserAndFamily($userId, $familyId);

        return $membership !== null && $membership->role === 'owner';
    }

    public function requireMembership(string $userId, string $familyId): MembershipData
    {
        $membership = $this->findByUserAndFamily($userId, $familyId);

        if ($membership === null) {
            throw new FamilyServiceException('このグループに所属していません', 403);
        }

        return $membership;
    }

    public function requireOwner(string $userId, string $familyId): MembershipData
    {
        $membership = $this->requireMembership($userId, $familyId);

        if ($membership->role !== 'owner') {
            throw new FamilyServiceException('この操作はオーナーのみ実行できます', 403);
        }

        return $membership;
    }

    public function membershipReference(string $familyId, string $userId): \Google\Cloud\Firestore\DocumentReference
    {
        return $this->client()
            ->collection(self::COLLECTION)
            ->document(self::documentId($familyId, $userId));
    }

    private function client(): FirestoreClient
    {
        if (! $this->firestore->isConfigured()) {
            throw new FamilyServiceException('Firestore is not configured.');
        }

        return $this->firestore->getClient();
    }

    private function mapSnapshot(DocumentSnapshot $snapshot): MembershipData
    {
        /** @var array<string, mixed> $data */
        $data = $snapshot->data() ?? [];

        return MembershipData::fromFirestore($snapshot->id(), $data);
    }
}
