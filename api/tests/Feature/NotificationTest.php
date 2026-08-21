<?php

namespace Tests\Feature;

use App\Data\NotificationData;
use App\Data\VerifiedFirebaseUser;
use App\Exceptions\NotificationServiceException;
use App\Services\FirebaseAuthService;
use App\Services\NotificationService;
use Mockery\MockInterface;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    private function notificationFixture(array $overrides = []): NotificationData
    {
        return new NotificationData(
            id: $overrides['id'] ?? 'notif-1',
            userId: $overrides['userId'] ?? 'firebase-uid-123',
            familyId: $overrides['familyId'] ?? 'family-1',
            type: $overrides['type'] ?? NotificationData::TYPE_TASK_ASSIGNED,
            taskId: $overrides['taskId'] ?? 'task-1',
            actorUserId: array_key_exists('actorUserId', $overrides)
                ? $overrides['actorUserId']
                : 'brother',
            title: $overrides['title'] ?? '兄さんからタスクが届きました',
            message: $overrides['message'] ?? '「ゴミ出し」',
            taskDate: $overrides['taskDate'] ?? '2026-08-21',
            readAt: array_key_exists('readAt', $overrides) ? $overrides['readAt'] : null,
            createdAt: $overrides['createdAt'] ?? '2026-08-21T00:00:00+00:00',
            updatedAt: $overrides['updatedAt'] ?? '2026-08-21T00:00:00+00:00',
            dedupeKey: $overrides['dedupeKey'] ?? 'task.assigned:task-1',
        );
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->mock(FirebaseAuthService::class, function (MockInterface $mock) {
            $mock->shouldReceive('verifyIdToken')
                ->andReturn(new VerifiedFirebaseUser(
                    uid: 'firebase-uid-123',
                    email: 'user@example.com',
                    emailVerified: false,
                ));
        });
    }

    public function test_notifications_index_requires_authentication(): void
    {
        $this->getJson('/api/notifications')
            ->assertUnauthorized()
            ->assertJson(['message' => '認証が必要です']);
    }

    public function test_notifications_index_returns_own_list_and_unread_count(): void
    {
        $this->mock(NotificationService::class, function (MockInterface $mock) {
            $mock->shouldReceive('listForUser')
                ->once()
                ->with('firebase-uid-123')
                ->andReturn([
                    $this->notificationFixture(),
                    $this->notificationFixture([
                        'id' => 'notif-2',
                        'readAt' => '2026-08-21T01:00:00+00:00',
                    ]),
                ]);
        });

        $this->getJson('/api/notifications', [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertOk()
            ->assertJsonPath('notifications.0.id', 'notif-1')
            ->assertJsonPath('unreadCount', 1);
    }

    public function test_mark_read_uses_authenticated_uid(): void
    {
        $this->mock(NotificationService::class, function (MockInterface $mock) {
            $mock->shouldReceive('markRead')
                ->once()
                ->with('firebase-uid-123', 'notif-1')
                ->andReturn($this->notificationFixture([
                    'readAt' => '2026-08-21T02:00:00+00:00',
                ]));
        });

        $this->patchJson('/api/notifications/notif-1/read', [], [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertOk()
            ->assertJsonPath('notification.readAt', '2026-08-21T02:00:00+00:00');
    }

    public function test_mark_read_rejects_other_users_notification(): void
    {
        $this->mock(NotificationService::class, function (MockInterface $mock) {
            $mock->shouldReceive('markRead')
                ->once()
                ->with('firebase-uid-123', 'notif-other')
                ->andThrow(new NotificationServiceException('この通知にアクセスできません', 403));
        });

        $this->patchJson('/api/notifications/notif-other/read', [], [
            'Authorization' => 'Bearer valid-token',
        ])->assertForbidden();
    }

    public function test_mark_all_read(): void
    {
        $this->mock(NotificationService::class, function (MockInterface $mock) {
            $mock->shouldReceive('markAllRead')
                ->once()
                ->with('firebase-uid-123')
                ->andReturn(['updatedCount' => 3]);
        });

        $this->postJson('/api/notifications/read-all', [], [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertOk()
            ->assertJson(['updatedCount' => 3]);
    }

    public function test_list_does_not_accept_body_user_id(): void
    {
        $this->mock(NotificationService::class, function (MockInterface $mock) {
            $mock->shouldReceive('listForUser')
                ->once()
                ->with('firebase-uid-123')
                ->andReturn([]);
        });

        $this->getJson('/api/notifications?userId=attacker', [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertOk()
            ->assertJsonPath('unreadCount', 0);
    }
}
