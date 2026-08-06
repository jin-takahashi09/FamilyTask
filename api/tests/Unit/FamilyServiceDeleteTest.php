<?php

namespace Tests\Unit;

use App\Data\MembershipData;
use App\Exceptions\FamilyServiceException;
use App\Services\FamilyService;
use App\Services\FirestoreService;
use App\Services\InviteCodeGenerator;
use App\Services\MembershipService;
use App\Services\UserProfileService;
use Google\Cloud\Firestore\DocumentReference;
use Google\Cloud\Firestore\DocumentSnapshot;
use Google\Cloud\Firestore\FirestoreClient;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class FamilyServiceDeleteTest extends TestCase
{
    private const FAMILY_ID = 'family-1';

    private const OWNER_ID = 'owner-uid';

    private const OTHER_FAMILY_ID = 'family-2';

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_delete_succeeds_with_zero_memberships(): void
    {
        $service = $this->makeService(
            memberships: [],
            familyExists: true,
        );

        $service->delete(self::OWNER_ID, self::FAMILY_ID, '高橋家');

        $this->assertTrue(true);
    }

    public function test_delete_succeeds_with_one_membership(): void
    {
        $service = $this->makeService(
            memberships: [$this->membership(self::FAMILY_ID, self::OWNER_ID, 'owner')],
            familyExists: true,
            expectedBatchDeletes: 1,
        );

        $service->delete(self::OWNER_ID, self::FAMILY_ID, '高橋家');

        $this->assertTrue(true);
    }

    public function test_delete_succeeds_with_multiple_memberships(): void
    {
        $service = $this->makeService(
            memberships: [
                $this->membership(self::FAMILY_ID, self::OWNER_ID, 'owner'),
                $this->membership(self::FAMILY_ID, 'member-uid', 'member'),
                $this->membership(self::FAMILY_ID, 'member-2-uid', 'member'),
            ],
            familyExists: true,
            expectedBatchDeletes: 3,
        );

        $service->delete(self::OWNER_ID, self::FAMILY_ID, '高橋家');

        $this->assertTrue(true);
    }

    public function test_delete_is_idempotent_when_already_removed(): void
    {
        $service = $this->makeService(
            memberships: [],
            familyExists: false,
            expectOwnerCheck: false,
            expectFamilyDelete: false,
        );

        $service->delete(self::OWNER_ID, self::FAMILY_ID, '高橋家');

        $this->assertTrue(true);
    }

    public function test_delete_can_resume_after_partial_membership_cleanup(): void
    {
        $service = $this->makeService(
            memberships: [
                $this->membership(self::FAMILY_ID, 'member-uid', 'member'),
            ],
            familyExists: false,
            expectedBatchDeletes: 1,
            expectFamilyDelete: false,
        );

        $service->delete(self::OWNER_ID, self::FAMILY_ID, 'ignored-name');

        $this->assertTrue(true);
    }

    public function test_delete_does_not_remove_other_family_memberships(): void
    {
        $service = $this->makeService(
            memberships: [
                $this->membership(self::FAMILY_ID, self::OWNER_ID, 'owner'),
                $this->membership(self::OTHER_FAMILY_ID, self::OWNER_ID, 'owner'),
            ],
            familyExists: true,
            expectedBatchDeletes: 1,
        );

        $service->delete(self::OWNER_ID, self::FAMILY_ID, '高橋家');

        $this->assertTrue(true);
    }

    public function test_delete_does_not_remove_users(): void
    {
        $profiles = Mockery::mock(UserProfileService::class);
        $profiles->shouldNotReceive('delete');

        $service = $this->makeService(
            memberships: [$this->membership(self::FAMILY_ID, self::OWNER_ID, 'owner')],
            familyExists: true,
            expectedBatchDeletes: 1,
            profiles: $profiles,
        );

        $service->delete(self::OWNER_ID, self::FAMILY_ID, '高橋家');

        $this->assertTrue(true);
    }

    public function test_delete_rejects_non_owner(): void
    {
        $memberships = Mockery::mock(MembershipService::class);
        $memberships->shouldReceive('listByFamilyId')
            ->once()
            ->with(self::FAMILY_ID)
            ->andReturn([$this->membership(self::FAMILY_ID, 'member-uid', 'member')]);
        $memberships->shouldReceive('requireOwner')
            ->once()
            ->with('member-uid', self::FAMILY_ID)
            ->andThrow(new FamilyServiceException('この操作はオーナーのみ実行できます', 403));

        $service = new FamilyService(
            $this->firestoreMock(
                memberships: [$this->membership(self::FAMILY_ID, 'member-uid', 'member')],
                familyExists: true,
                expectedBatchDeletes: 0,
                expectFamilyDelete: false,
            ),
            $memberships,
            Mockery::mock(UserProfileService::class),
            Mockery::mock(InviteCodeGenerator::class),
        );

        $this->expectException(FamilyServiceException::class);
        $this->expectExceptionMessage('この操作はオーナーのみ実行できます');

        $service->delete('member-uid', self::FAMILY_ID, '高橋家');
    }

    public function test_delete_returns_service_error_on_firestore_failure(): void
    {
        $service = $this->makeService(
            memberships: [$this->membership(self::FAMILY_ID, self::OWNER_ID, 'owner')],
            familyExists: true,
            expectedBatchDeletes: 1,
            batchCommitThrows: new RuntimeException('gRPC deadline exceeded'),
            individualDeleteThrows: new RuntimeException('gRPC deadline exceeded'),
            expectFamilyDelete: false,
        );

        try {
            $service->delete(self::OWNER_ID, self::FAMILY_ID, '高橋家');
            $this->fail('Expected FamilyServiceException was not thrown');
        } catch (FamilyServiceException $exception) {
            $this->assertSame('グループを削除できませんでした', $exception->getMessage());
            $this->assertSame(503, $exception->statusCode);
            $this->assertStringNotContainsString('gRPC', $exception->getMessage());
        }
    }

    public function test_delete_rejects_mismatched_confirm_name(): void
    {
        $service = $this->makeService(
            memberships: [$this->membership(self::FAMILY_ID, self::OWNER_ID, 'owner')],
            familyExists: true,
            expectOwnerCheck: true,
            expectedBatchDeletes: 0,
            expectFamilyDelete: false,
        );

        $this->expectException(FamilyServiceException::class);
        $this->expectExceptionMessage('グループ名が一致しません');

        $service->delete(self::OWNER_ID, self::FAMILY_ID, 'wrong-name');
    }

    /**
     * @param  list<MembershipData>  $memberships
     * @param  list<string>  $deletedMembershipIds
     */
    private function makeService(
        array $memberships,
        bool $familyExists,
        int $expectedBatchDeletes = 0,
        array &$deletedMembershipIds = [],
        bool $expectOwnerCheck = true,
        bool $expectFamilyDelete = true,
        ?\Throwable $batchCommitThrows = null,
        ?\Throwable $individualDeleteThrows = null,
        ?UserProfileService $profiles = null,
    ): FamilyService {
        $membershipService = Mockery::mock(MembershipService::class);
        $membershipService->shouldReceive('listByFamilyId')
            ->once()
            ->with(self::FAMILY_ID)
            ->andReturn($memberships);

        if ($expectOwnerCheck) {
            $membershipService->shouldReceive('requireOwner')
                ->once()
                ->with(self::OWNER_ID, self::FAMILY_ID)
                ->andReturn($this->membership(self::FAMILY_ID, self::OWNER_ID, 'owner'));
        }

        return new FamilyService(
            $this->firestoreMock(
                memberships: $memberships,
                familyExists: $familyExists,
                expectedBatchDeletes: $expectedBatchDeletes,
                deletedMembershipIds: $deletedMembershipIds,
                batchCommitThrows: $batchCommitThrows,
                individualDeleteThrows: $individualDeleteThrows,
                expectFamilyDelete: $expectFamilyDelete,
            ),
            $membershipService,
            $profiles ?? Mockery::mock(UserProfileService::class),
            Mockery::mock(InviteCodeGenerator::class),
        );
    }

    /**
     * @param  list<MembershipData>  $memberships
     * @param  list<string>  $deletedMembershipIds
     */
    private function firestoreMock(
        array $memberships,
        bool $familyExists,
        int $expectedBatchDeletes = 0,
        array &$deletedMembershipIds = [],
        ?\Throwable $batchCommitThrows = null,
        ?\Throwable $individualDeleteThrows = null,
        bool $expectFamilyDelete = true,
    ): FirestoreService {
        $targetMemberships = array_values(array_filter(
            $memberships,
            fn (MembershipData $membership) => $membership->familyId === self::FAMILY_ID,
        ));

        $membershipRefs = [];
        foreach ($targetMemberships as $membership) {
            $snapshot = Mockery::mock(DocumentSnapshot::class);
            $snapshot->shouldReceive('exists')->andReturn(true);

            $ref = Mockery::mock(DocumentReference::class);
            $ref->shouldReceive('path')->andReturn('memberships/'.$membership->id);
            $ref->shouldReceive('snapshot')->andReturn($snapshot);
            if ($individualDeleteThrows !== null) {
                $ref->shouldReceive('delete')->andThrow($individualDeleteThrows);
            } else {
                $ref->shouldReceive('delete')->andReturnUsing(function () use (&$deletedMembershipIds, $membership): null {
                    $deletedMembershipIds[] = $membership->id;

                    return null;
                });
            }

            $membershipRefs[$membership->id] = $ref;
        }

        $membershipsCollection = Mockery::mock();
        $membershipsCollection->shouldReceive('document')
            ->andReturnUsing(fn (string $id) => $membershipRefs[$id] ?? Mockery::mock(DocumentReference::class));

        $familySnapshot = Mockery::mock(DocumentSnapshot::class);
        $familySnapshot->shouldReceive('exists')->andReturn($familyExists);
        if ($familyExists) {
            $familySnapshot->shouldReceive('data')->andReturn([
                'name' => '高橋家',
                'inviteCode' => 'ABC123',
                'ownerId' => self::OWNER_ID,
                'createdAt' => '2026-08-06T00:00:00+00:00',
                'updatedAt' => '2026-08-06T00:00:00+00:00',
            ]);
            $familySnapshot->shouldReceive('id')->andReturn(self::FAMILY_ID);
        }

        $familyRef = Mockery::mock(DocumentReference::class);
        $familyRef->shouldReceive('snapshot')->andReturn($familySnapshot);
        if ($familyExists && $expectFamilyDelete && $individualDeleteThrows === null && $batchCommitThrows === null) {
            $familyRef->shouldReceive('delete')->once();
        }

        $familiesCollection = Mockery::mock();
        $familiesCollection->shouldReceive('document')
            ->with(self::FAMILY_ID)
            ->andReturn($familyRef);

        $batch = Mockery::mock();
        $batch->shouldReceive('delete')
            ->times($expectedBatchDeletes)
            ->andReturnSelf();

        if ($expectedBatchDeletes > 0) {
            if ($batchCommitThrows !== null) {
                $batch->shouldReceive('commit')->once()->andThrow($batchCommitThrows);
            } else {
                $batch->shouldReceive('commit')->once();
            }
        }

        $client = Mockery::mock(FirestoreClient::class);
        if ($expectedBatchDeletes > 0) {
            $client->shouldReceive('batch')->once()->andReturn($batch);
        }
        $client->shouldReceive('collection')
            ->with('memberships')
            ->andReturn($membershipsCollection);
        $client->shouldReceive('collection')
            ->with('families')
            ->andReturn($familiesCollection);

        $firestore = Mockery::mock(FirestoreService::class);
        $firestore->shouldReceive('isConfigured')->andReturn(true);
        $firestore->shouldReceive('getClient')->andReturn($client);

        return $firestore;
    }

    private function membership(string $familyId, string $userId, string $role): MembershipData
    {
        return new MembershipData(
            id: MembershipService::documentId($familyId, $userId),
            familyId: $familyId,
            userId: $userId,
            role: $role,
            joinedAt: '2026-08-06T00:00:00+00:00',
        );
    }
}
