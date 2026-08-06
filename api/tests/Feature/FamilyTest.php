<?php

namespace Tests\Feature;

use App\Data\FamilyData;
use App\Data\FamilyMemberData;
use App\Exceptions\FamilyServiceException;
use App\Services\FamilyService;
use Mockery\MockInterface;
use Tests\TestCase;

class FamilyTest extends TestCase
{
    private function familyFixture(string $role = 'owner', ?string $joinedAt = null): FamilyData
    {
        return new FamilyData(
            id: 'family-1',
            name: '高橋家',
            inviteCode: 'ABC123',
            ownerId: 'firebase-uid-123',
            createdAt: '2026-08-06T00:00:00+00:00',
            updatedAt: '2026-08-06T00:00:00+00:00',
            role: $role,
            joinedAt: $joinedAt ?? '2026-08-06T00:00:00+00:00',
        );
    }

    public function test_families_index_requires_authentication(): void
    {
        $this->getJson('/api/families')
            ->assertUnauthorized()
            ->assertJson(['message' => '認証が必要です']);
    }

    public function test_families_index_returns_user_families(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('listForUser')
                ->once()
                ->with('firebase-uid-123')
                ->andReturn([$this->familyFixture()]);
        });

        $this->getJson('/api/families', ['Authorization' => 'Bearer valid-token'])
            ->assertOk()
            ->assertJsonPath('families.0.id', 'family-1')
            ->assertJsonPath('families.0.role', 'owner');
    }

    public function test_families_store_creates_family(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('create')
                ->once()
                ->with('firebase-uid-123', '高橋家')
                ->andReturn($this->familyFixture());
        });

        $this->postJson('/api/families', ['name' => '高橋家'], [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertCreated()
            ->assertJsonPath('family.name', '高橋家')
            ->assertJsonPath('family.role', 'owner');
    }

    public function test_families_store_uses_authenticated_uid_not_request(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('create')
                ->once()
                ->with('firebase-uid-123', '高橋家')
                ->andReturn($this->familyFixture());
        });

        $this->postJson('/api/families', [
            'name' => '高橋家',
            'ownerId' => 'attacker-uid',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])->assertCreated();
    }

    public function test_families_store_rejects_invalid_name(): void
    {
        $this->postJson('/api/families', ['name' => ''], [
            'Authorization' => 'Bearer valid-token',
        ])->assertUnprocessable();
    }

    public function test_families_join_adds_member(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('join')
                ->once()
                ->with('firebase-uid-123', 'ABC123')
                ->andReturn($this->familyFixture('member'));
        });

        $this->postJson('/api/families/join', ['inviteCode' => 'abc123'], [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertOk()
            ->assertJsonPath('family.role', 'member');
    }

    public function test_families_join_returns_conflict_on_duplicate(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('join')
                ->once()
                ->andThrow(new FamilyServiceException('このグループには既に参加しています', 409));
        });

        $this->postJson('/api/families/join', ['inviteCode' => 'ABC123'], [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertStatus(409)
            ->assertJson(['message' => 'このグループには既に参加しています']);
    }

    public function test_families_join_returns_error_on_invalid_code(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('join')
                ->once()
                ->andThrow(new FamilyServiceException('招待コードが正しくありません', 422));
        });

        $this->postJson('/api/families/join', ['inviteCode' => 'ZZZZZZ'], [
            'Authorization' => 'Bearer valid-token',
        ])->assertStatus(422);
    }

    public function test_families_show_denies_non_member(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('getForMember')
                ->once()
                ->with('firebase-uid-123', 'family-1')
                ->andThrow(new FamilyServiceException('このグループに所属していません', 403));
        });

        $this->getJson('/api/families/family-1', [
            'Authorization' => 'Bearer valid-token',
        ])->assertForbidden();
    }

    public function test_families_members_returns_member_list(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('listMembers')
                ->once()
                ->with('firebase-uid-123', 'family-1')
                ->andReturn([
                    new FamilyMemberData(
                        userId: 'firebase-uid-123',
                        displayName: 'ユーザーA',
                        email: 'user@example.com',
                        profileImage: null,
                        role: 'owner',
                        joinedAt: '2026-08-06T00:00:00+00:00',
                    ),
                ]);
        });

        $this->getJson('/api/families/family-1/members', [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertOk()
            ->assertJsonPath('members.0.userId', 'firebase-uid-123');
    }

    public function test_families_leave_allows_member(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('leave')
                ->once()
                ->with('firebase-uid-123', 'family-1');
        });

        $this->postJson('/api/families/family-1/leave', [], [
            'Authorization' => 'Bearer valid-token',
        ])->assertOk();
    }

    public function test_families_leave_rejects_owner(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('leave')
                ->once()
                ->andThrow(new FamilyServiceException(
                    'オーナーは退出する前に、オーナー権限の移譲またはグループの削除を行ってください',
                    403,
                ));
        });

        $this->postJson('/api/families/family-1/leave', [], [
            'Authorization' => 'Bearer valid-token',
        ])->assertForbidden();
    }

    public function test_families_remove_member_by_owner(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('removeMember')
                ->once()
                ->with('firebase-uid-123', 'family-1', 'target-uid');
        });

        $this->deleteJson('/api/families/family-1/members/target-uid', [], [
            'Authorization' => 'Bearer valid-token',
        ])->assertOk();
    }

    public function test_families_remove_member_rejects_non_owner(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('removeMember')
                ->once()
                ->andThrow(new FamilyServiceException('この操作はオーナーのみ実行できます', 403));
        });

        $this->deleteJson('/api/families/family-1/members/target-uid', [], [
            'Authorization' => 'Bearer valid-token',
        ])->assertForbidden();
    }

    public function test_families_remove_member_rejects_self(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('removeMember')
                ->once()
                ->andThrow(new FamilyServiceException('自分自身は削除できません', 403));
        });

        $this->deleteJson('/api/families/family-1/members/firebase-uid-123', [], [
            'Authorization' => 'Bearer valid-token',
        ])->assertForbidden();
    }

    public function test_families_transfer_ownership(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('transferOwnership')
                ->once()
                ->with('firebase-uid-123', 'family-1', 'target-uid')
                ->andReturn($this->familyFixture('member'));
        });

        $this->postJson('/api/families/family-1/transfer-ownership', [
            'targetUserId' => 'target-uid',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertOk()
            ->assertJsonPath('family.role', 'member');
    }

    public function test_families_delete_requires_confirm_name(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('delete')
                ->once()
                ->with('firebase-uid-123', 'family-1', '高橋家');
        });

        $this->deleteJson('/api/families/family-1', [
            'confirmName' => '高橋家',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])->assertOk();
    }

    public function test_families_delete_rejects_mismatch_name(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('delete')
                ->once()
                ->andThrow(new FamilyServiceException('グループ名が一致しません。削除を中止しました', 422));
        });

        $this->deleteJson('/api/families/family-1', [
            'confirmName' => 'wrong',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])->assertStatus(422);
    }

    public function test_families_delete_rejects_non_owner(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('delete')
                ->once()
                ->andThrow(new FamilyServiceException('この操作はオーナーのみ実行できます', 403));
        });

        $this->deleteJson('/api/families/family-1', [
            'confirmName' => '高橋家',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])->assertForbidden();
    }

    public function test_families_delete_returns_service_unavailable_on_firestore_error(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('delete')
                ->once()
                ->andThrow(new FamilyServiceException('グループを削除できませんでした'));
        });

        $this->deleteJson('/api/families/family-1', [
            'confirmName' => '高橋家',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertStatus(503)
            ->assertJson(['message' => 'グループを削除できませんでした'])
            ->assertJsonMissing(['gRPC']);
    }

    public function test_families_regenerate_invite_code(): void
    {
        $family = new FamilyData(
            id: 'family-1',
            name: '高橋家',
            inviteCode: 'NEW456',
            ownerId: 'firebase-uid-123',
            createdAt: '2026-08-06T00:00:00+00:00',
            updatedAt: '2026-08-06T01:00:00+00:00',
            role: 'owner',
        );

        $this->mock(FamilyService::class, function (MockInterface $mock) use ($family) {
            $mock->shouldReceive('regenerateInviteCode')
                ->once()
                ->with('firebase-uid-123', 'family-1')
                ->andReturn($family);
        });

        $this->postJson('/api/families/family-1/invite-code/regenerate', [], [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertOk()
            ->assertJsonPath('family.inviteCode', 'NEW456');
    }

    public function test_families_regenerate_rejects_non_owner(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('regenerateInviteCode')
                ->once()
                ->andThrow(new FamilyServiceException('この操作はオーナーのみ実行できます', 403));
        });

        $this->postJson('/api/families/family-1/invite-code/regenerate', [], [
            'Authorization' => 'Bearer valid-token',
        ])->assertForbidden();
    }

    public function test_families_does_not_expose_internal_exception(): void
    {
        $this->mock(FamilyService::class, function (MockInterface $mock) {
            $mock->shouldReceive('listForUser')
                ->once()
                ->andThrow(new FamilyServiceException('所属グループを取得できませんでした'));
        });

        $this->getJson('/api/families', [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertStatus(503)
            ->assertJson(['message' => '所属グループを取得できませんでした'])
            ->assertJsonMissing(['secret internal failure']);
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->mock(\App\Services\FirebaseAuthService::class, function (MockInterface $mock) {
            $mock->shouldReceive('verifyIdToken')
                ->andReturn(new \App\Data\VerifiedFirebaseUser(
                    uid: 'firebase-uid-123',
                    email: 'user@example.com',
                    emailVerified: false,
                ));
        });
    }
}
