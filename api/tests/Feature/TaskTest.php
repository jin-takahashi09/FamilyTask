<?php

namespace Tests\Feature;

use App\Data\TaskData;
use App\Exceptions\TaskServiceException;
use App\Services\TaskService;
use Mockery\MockInterface;
use Tests\TestCase;

class TaskTest extends TestCase
{
    private function taskFixture(array $overrides = []): TaskData
    {
        return new TaskData(
            id: $overrides['id'] ?? 'task-1',
            familyId: $overrides['familyId'] ?? 'family-1',
            date: $overrides['date'] ?? '2026-08-06',
            title: $overrides['title'] ?? 'ゴミ出し',
            requesterId: array_key_exists('requesterId', $overrides) ? $overrides['requesterId'] : null,
            assigneeId: $overrides['assigneeId'] ?? 'firebase-uid-123',
            deadlineTime: $overrides['deadlineTime'] ?? null,
            completed: $overrides['completed'] ?? false,
            alarmEnabled: $overrides['alarmEnabled'] ?? true,
            notifyOnComplete: $overrides['notifyOnComplete'] ?? false,
            repeatType: $overrides['repeatType'] ?? 'none',
            repeatWeekday: $overrides['repeatWeekday'] ?? null,
            repeatEndDate: $overrides['repeatEndDate'] ?? null,
            recurrenceGroupId: $overrides['recurrenceGroupId'] ?? null,
            createdBy: $overrides['createdBy'] ?? 'firebase-uid-123',
            createdAt: $overrides['createdAt'] ?? '2026-08-06T00:00:00+00:00',
            updatedAt: $overrides['updatedAt'] ?? '2026-08-06T00:00:00+00:00',
            completedAt: $overrides['completedAt'] ?? null,
        );
    }

    public function test_tasks_index_requires_authentication(): void
    {
        $this->getJson('/api/families/family-1/tasks')
            ->assertUnauthorized()
            ->assertJson(['message' => '認証が必要です']);
    }

    public function test_tasks_index_denies_non_member(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('listForFamily')
                ->once()
                ->andThrow(new TaskServiceException('このグループに所属していません', 403));
        });

        $this->getJson('/api/families/family-1/tasks', [
            'Authorization' => 'Bearer valid-token',
        ])->assertForbidden();
    }

    public function test_tasks_index_returns_family_tasks(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('listForFamily')
                ->once()
                ->with('firebase-uid-123', 'family-1', null, null, null)
                ->andReturn([$this->taskFixture()]);
        });

        $this->getJson('/api/families/family-1/tasks', [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertOk()
            ->assertJsonPath('tasks.0.id', 'task-1');
    }

    public function test_tasks_index_filters_by_date(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('listForFamily')
                ->once()
                ->with('firebase-uid-123', 'family-1', '2026-08-06', null, null)
                ->andReturn([$this->taskFixture()]);
        });

        $this->getJson('/api/families/family-1/tasks?date=2026-08-06', [
            'Authorization' => 'Bearer valid-token',
        ])->assertOk();
    }

    public function test_tasks_index_filters_by_assignee(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('listForFamily')
                ->once()
                ->with('firebase-uid-123', 'family-1', null, 'member-uid', null)
                ->andReturn([]);
        });

        $this->getJson('/api/families/family-1/tasks?assigneeId=member-uid', [
            'Authorization' => 'Bearer valid-token',
        ])->assertOk();
    }

    public function test_tasks_store_creates_personal_task(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('create')
                ->once()
                ->with('firebase-uid-123', 'family-1', \Mockery::subset([
                    'title' => '自分用',
                    'taskType' => 'personal',
                ]))
                ->andReturn([$this->taskFixture(['title' => '自分用'])]);
        });

        $this->postJson('/api/families/family-1/tasks', [
            'date' => '2026-08-06',
            'title' => '自分用',
            'taskType' => 'personal',
            'assigneeId' => 'firebase-uid-123',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertCreated()
            ->assertJsonPath('tasks.0.title', '自分用');
    }

    public function test_tasks_store_creates_family_request(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('create')
                ->once()
                ->with('firebase-uid-123', 'family-1', \Mockery::subset([
                    'taskType' => 'request',
                    'assigneeId' => 'member-uid',
                ]))
                ->andReturn([
                    $this->taskFixture([
                        'requesterId' => 'firebase-uid-123',
                        'assigneeId' => 'member-uid',
                    ]),
                ]);
        });

        $this->postJson('/api/families/family-1/tasks', [
            'date' => '2026-08-06',
            'title' => '依頼',
            'taskType' => 'request',
            'assigneeId' => 'member-uid',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])->assertCreated();
    }

    public function test_tasks_store_rejects_outsider_assignee(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('create')
                ->once()
                ->andThrow(new TaskServiceException('担当者が家族に所属していません', 422));
        });

        $this->postJson('/api/families/family-1/tasks', [
            'date' => '2026-08-06',
            'title' => '依頼',
            'taskType' => 'request',
            'assigneeId' => 'outsider-uid',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])->assertStatus(422);
    }

    public function test_tasks_update_updates_task(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('update')
                ->once()
                ->with('firebase-uid-123', 'family-1', 'task-1', \Mockery::subset([
                    'title' => '更新後',
                ]))
                ->andReturn($this->taskFixture(['title' => '更新後']));
        });

        $this->putJson('/api/families/family-1/tasks/task-1', [
            'title' => '更新後',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertOk()
            ->assertJsonPath('task.title', '更新後');
    }

    public function test_tasks_complete_toggles_completed(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('setCompleted')
                ->once()
                ->with('firebase-uid-123', 'family-1', 'task-1', true)
                ->andReturn($this->taskFixture([
                    'completed' => true,
                    'completedAt' => '2026-08-06T12:00:00+00:00',
                ]));
        });

        $this->patchJson('/api/families/family-1/tasks/task-1/complete', [
            'completed' => true,
        ], [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertOk()
            ->assertJsonPath('task.completed', true);
    }

    public function test_tasks_destroy_deletes_task(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('delete')
                ->once()
                ->with('firebase-uid-123', 'family-1', 'task-1');
        });

        $this->deleteJson('/api/families/family-1/tasks/task-1', [], [
            'Authorization' => 'Bearer valid-token',
        ])->assertOk();
    }

    public function test_tasks_store_creates_recurring_tasks(): void
    {
        $groupId = 'group-1';
        $this->mock(TaskService::class, function (MockInterface $mock) use ($groupId) {
            $mock->shouldReceive('create')
                ->once()
                ->andReturn([
                    $this->taskFixture(['id' => 'task-a', 'recurrenceGroupId' => $groupId]),
                    $this->taskFixture(['id' => 'task-b', 'recurrenceGroupId' => $groupId, 'date' => '2026-08-07']),
                ]);
        });

        $this->postJson('/api/families/family-1/tasks', [
            'date' => '2026-08-06',
            'title' => '毎日',
            'taskType' => 'personal',
            'assigneeId' => 'firebase-uid-123',
            'repeatType' => 'daily',
            'repeatEndDate' => '2026-08-07',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertCreated()
            ->assertJsonCount(2, 'tasks');
    }

    public function test_recurrence_destroy_single_scope(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('deleteRecurrence')
                ->once()
                ->with('firebase-uid-123', 'family-1', 'group-1', [
                    'scope' => 'single',
                    'taskId' => 'task-1',
                ]);
        });

        $this->deleteJson('/api/families/family-1/recurrences/group-1', [
            'scope' => 'single',
            'taskId' => 'task-1',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])->assertOk();
    }

    public function test_recurrence_destroy_future_scope(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('deleteRecurrence')
                ->once()
                ->with('firebase-uid-123', 'family-1', 'group-1', [
                    'scope' => 'future',
                    'fromDate' => '2026-08-10',
                ]);
        });

        $this->deleteJson('/api/families/family-1/recurrences/group-1', [
            'scope' => 'future',
            'fromDate' => '2026-08-10',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])->assertOk();
    }

    public function test_recurrence_destroy_all_scope(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('deleteRecurrence')
                ->once()
                ->with('firebase-uid-123', 'family-1', 'group-1', [
                    'scope' => 'all',
                ]);
        });

        $this->deleteJson('/api/families/family-1/recurrences/group-1', [
            'scope' => 'all',
        ], [
            'Authorization' => 'Bearer valid-token',
        ])->assertOk();
    }

    public function test_tasks_show_returns_404_for_other_family(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('getForMember')
                ->once()
                ->andThrow(new TaskServiceException('タスクが見つかりません', 404));
        });

        $this->getJson('/api/families/family-1/tasks/other-task', [
            'Authorization' => 'Bearer valid-token',
        ])->assertNotFound();
    }

    public function test_internal_errors_are_not_exposed(): void
    {
        $this->mock(TaskService::class, function (MockInterface $mock) {
            $mock->shouldReceive('listForFamily')
                ->once()
                ->andThrow(new TaskServiceException('タスク一覧を取得できませんでした'));
        });

        $this->getJson('/api/families/family-1/tasks', [
            'Authorization' => 'Bearer valid-token',
        ])
            ->assertStatus(503)
            ->assertJson(['message' => 'タスク一覧を取得できませんでした'])
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
