<?php

namespace Tests\Unit;

use App\Data\TaskData;
use App\Services\FirestoreService;
use App\Services\NotificationBroadcaster;
use App\Services\NotificationService;
use App\Services\UserProfileService;
use Mockery;
use Tests\TestCase;

class NotificationServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function service(): NotificationService
    {
        return new NotificationService(
            Mockery::mock(FirestoreService::class),
            Mockery::mock(UserProfileService::class),
            Mockery::mock(NotificationBroadcaster::class),
        );
    }

    private function task(array $overrides = []): TaskData
    {
        return new TaskData(
            id: $overrides['id'] ?? 'task-1',
            familyId: $overrides['familyId'] ?? 'family-1',
            date: $overrides['date'] ?? '2026-08-21',
            title: $overrides['title'] ?? 'ゴミ出し',
            requesterId: array_key_exists('requesterId', $overrides)
                ? $overrides['requesterId']
                : 'brother',
            assigneeId: $overrides['assigneeId'] ?? 'jin',
            deadlineTime: $overrides['deadlineTime'] ?? '18:00',
            completed: $overrides['completed'] ?? false,
            alarmEnabled: true,
            notifyOnComplete: false,
            repeatType: 'none',
            repeatWeekday: null,
            repeatEndDate: null,
            recurrenceGroupId: null,
            createdBy: $overrides['createdBy'] ?? 'brother',
            createdAt: '2026-08-21T00:00:00+00:00',
            updatedAt: '2026-08-21T00:00:00+00:00',
            completedAt: $overrides['completedAt'] ?? null,
        );
    }

    public function test_should_notify_assigned_for_request_task(): void
    {
        $this->assertTrue($this->service()->shouldNotifyAssigned($this->task()));
    }

    public function test_should_not_notify_assigned_for_personal_task(): void
    {
        $this->assertFalse($this->service()->shouldNotifyAssigned($this->task([
            'requesterId' => null,
            'assigneeId' => 'jin',
            'createdBy' => 'jin',
        ])));
    }

    public function test_should_not_notify_assigned_when_requester_is_assignee(): void
    {
        $this->assertFalse($this->service()->shouldNotifyAssigned($this->task([
            'requesterId' => 'jin',
            'assigneeId' => 'jin',
        ])));
    }

    public function test_should_notify_completed_on_incomplete_to_complete(): void
    {
        $this->assertTrue($this->service()->shouldNotifyCompleted(
            $this->task(['completed' => true, 'completedAt' => '2026-08-21T10:00:00+00:00']),
            false,
        ));
    }

    public function test_should_not_notify_completed_when_already_completed(): void
    {
        $this->assertFalse($this->service()->shouldNotifyCompleted(
            $this->task(['completed' => true]),
            true,
        ));
    }

    public function test_should_not_notify_completed_on_complete_to_incomplete(): void
    {
        $this->assertFalse($this->service()->shouldNotifyCompleted(
            $this->task(['completed' => false]),
            true,
        ));
    }

    public function test_should_not_notify_completed_for_personal_task(): void
    {
        $this->assertFalse($this->service()->shouldNotifyCompleted(
            $this->task([
                'requesterId' => null,
                'assigneeId' => 'jin',
                'completed' => true,
            ]),
            false,
        ));
    }

    public function test_due_soon_notifies_assignee_with_deadline_dedupe_key(): void
    {
        $firestore = Mockery::mock(FirestoreService::class);
        $profiles = Mockery::mock(UserProfileService::class);
        $broadcaster = Mockery::mock(NotificationBroadcaster::class);

        $service = new class($firestore, $profiles, $broadcaster) extends NotificationService {
            /** @var array<string, mixed>|null */
            public ?array $lastInput = null;

            protected function existsByDedupeKey(string $dedupeKey): bool
            {
                return false;
            }

            public function createNotification(array $input): ?\App\Data\NotificationData
            {
                $this->lastInput = $input;

                return new \App\Data\NotificationData(
                    id: 'n-due',
                    userId: $input['userId'],
                    familyId: $input['familyId'],
                    type: $input['type'],
                    taskId: $input['taskId'],
                    actorUserId: $input['actorUserId'],
                    title: $input['title'],
                    message: $input['message'],
                    taskDate: $input['taskDate'],
                    readAt: null,
                    createdAt: '2026-08-21T17:30:00+09:00',
                    updatedAt: '2026-08-21T17:30:00+09:00',
                    dedupeKey: $input['dedupeKey'],
                );
            }
        };

        $created = $service->notifyTaskDueSoon($this->task([
            'requesterId' => 'brother',
            'assigneeId' => 'jin',
            'deadlineTime' => '18:00',
        ]));

        $this->assertNotNull($created);
        $this->assertSame('jin', $service->lastInput['userId']);
        $this->assertSame('task.due_soon', $service->lastInput['type']);
        $this->assertSame('task.due_soon:task-1:2026-08-21:18:00', $service->lastInput['dedupeKey']);
        $this->assertSame('締切が近づいています', $service->lastInput['title']);
        $this->assertSame('「ゴミ出し」の締切まで30分です', $service->lastInput['message']);
        $this->assertStringNotContainsString('（締切', $service->lastInput['message']);
    }

    public function test_due_soon_skipped_when_completed_or_no_deadline(): void
    {
        $service = $this->service();

        $this->assertNull($service->notifyTaskDueSoon($this->task(['completed' => true])));
        $this->assertNull($service->notifyTaskDueSoon($this->task(['deadlineTime' => null])));
        $this->assertNull($service->notifyTaskDueSoon($this->task(['assigneeId' => ''])));
    }

    public function test_due_soon_dedupe_key_changes_when_deadline_changes(): void
    {
        $firestore = Mockery::mock(FirestoreService::class);
        $profiles = Mockery::mock(UserProfileService::class);
        $broadcaster = Mockery::mock(NotificationBroadcaster::class);

        $service = new class($firestore, $profiles, $broadcaster) extends NotificationService {
            /** @var list<string> */
            public array $keys = [];

            protected function existsByDedupeKey(string $dedupeKey): bool
            {
                return false;
            }

            public function createNotification(array $input): ?\App\Data\NotificationData
            {
                $this->keys[] = (string) $input['dedupeKey'];

                return new \App\Data\NotificationData(
                    id: 'n-'.count($this->keys),
                    userId: $input['userId'],
                    familyId: $input['familyId'],
                    type: $input['type'],
                    taskId: $input['taskId'],
                    actorUserId: null,
                    title: $input['title'],
                    message: $input['message'],
                    taskDate: $input['taskDate'],
                    readAt: null,
                    createdAt: '2026-08-21T17:30:00+09:00',
                    updatedAt: '2026-08-21T17:30:00+09:00',
                    dedupeKey: $input['dedupeKey'],
                );
            }
        };

        $service->notifyTaskDueSoon($this->task(['deadlineTime' => '18:00']));
        $service->notifyTaskDueSoon($this->task(['deadlineTime' => '20:00']));

        $this->assertSame([
            'task.due_soon:task-1:2026-08-21:18:00',
            'task.due_soon:task-1:2026-08-21:20:00',
        ], $service->keys);
    }
}
