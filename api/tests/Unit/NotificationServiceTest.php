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
}
