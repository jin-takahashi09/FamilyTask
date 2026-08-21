<?php

namespace Tests\Unit;

use App\Data\TaskData;
use App\Services\DueSoonNotificationChecker;
use App\Services\FirestoreService;
use App\Services\NotificationService;
use DateTimeImmutable;
use DateTimeZone;
use Mockery;
use Tests\TestCase;

class DueSoonNotificationCheckerTest extends TestCase
{
    private DueSoonNotificationChecker $checker;

    protected function setUp(): void
    {
        parent::setUp();

        $this->checker = new DueSoonNotificationChecker(
            Mockery::mock(FirestoreService::class),
            Mockery::mock(NotificationService::class),
        );
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
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
                : null,
            assigneeId: $overrides['assigneeId'] ?? 'jin',
            deadlineTime: array_key_exists('deadlineTime', $overrides)
                ? $overrides['deadlineTime']
                : '18:00',
            completed: $overrides['completed'] ?? false,
            alarmEnabled: true,
            notifyOnComplete: false,
            repeatType: 'none',
            repeatWeekday: null,
            repeatEndDate: null,
            recurrenceGroupId: $overrides['recurrenceGroupId'] ?? null,
            createdBy: $overrides['createdBy'] ?? 'jin',
            createdAt: '2026-08-21T00:00:00+09:00',
            updatedAt: '2026-08-21T00:00:00+09:00',
            completedAt: null,
        );
    }

    private function tokyo(string $datetime): DateTimeImmutable
    {
        return new DateTimeImmutable($datetime, new DateTimeZone('Asia/Tokyo'));
    }

    public function test_notifies_at_exactly_30_minutes_before(): void
    {
        $this->assertTrue($this->checker->isInDueSoonWindow(
            $this->task(),
            $this->tokyo('2026-08-21 17:30:00'),
        ));
    }

    public function test_notifies_within_recovery_window(): void
    {
        $this->assertTrue($this->checker->isInDueSoonWindow(
            $this->task(),
            $this->tokyo('2026-08-21 17:34:00'),
        ));
    }

    public function test_does_not_notify_31_minutes_before(): void
    {
        $this->assertFalse($this->checker->isInDueSoonWindow(
            $this->task(),
            $this->tokyo('2026-08-21 17:29:00'),
        ));
    }

    public function test_does_not_notify_after_deadline(): void
    {
        $this->assertFalse($this->checker->isInDueSoonWindow(
            $this->task(),
            $this->tokyo('2026-08-21 18:01:00'),
        ));
    }

    public function test_does_not_notify_completed_task(): void
    {
        $this->assertFalse($this->checker->isInDueSoonWindow(
            $this->task(['completed' => true]),
            $this->tokyo('2026-08-21 17:30:00'),
        ));
    }

    public function test_does_not_notify_without_deadline_time(): void
    {
        $this->assertFalse($this->checker->isInDueSoonWindow(
            $this->task(['deadlineTime' => null]),
            $this->tokyo('2026-08-21 17:30:00'),
        ));
    }

    public function test_does_not_notify_without_assignee(): void
    {
        $this->assertFalse($this->checker->isInDueSoonWindow(
            $this->task(['assigneeId' => '']),
            $this->tokyo('2026-08-21 17:30:00'),
        ));
    }

    public function test_personal_task_is_eligible_for_assignee(): void
    {
        $this->assertTrue($this->checker->isInDueSoonWindow(
            $this->task([
                'requesterId' => null,
                'assigneeId' => 'jin',
                'createdBy' => 'jin',
            ]),
            $this->tokyo('2026-08-21 17:30:00'),
        ));
    }

    public function test_request_task_targets_assignee_not_requester(): void
    {
        $task = $this->task([
            'requesterId' => 'brother',
            'assigneeId' => 'jin',
        ]);

        $this->assertTrue($this->checker->isInDueSoonWindow(
            $task,
            $this->tokyo('2026-08-21 17:30:00'),
        ));
        $this->assertSame('jin', $task->assigneeId);
        $this->assertSame('brother', $task->requesterId);
    }

    public function test_midnight_crossover_candidate_dates(): void
    {
        // 23:45 → window covers deadline 00:10–00:15 on next day
        $keys = $this->checker->candidateDateKeys($this->tokyo('2026-08-21 23:45:00'));

        $this->assertSame(['2026-08-22'], $keys);
    }

    public function test_candidate_dates_span_two_days_near_midnight(): void
    {
        // 23:30 → [23:55 today, 00:00 tomorrow]
        $keys = $this->checker->candidateDateKeys($this->tokyo('2026-08-21 23:30:00'));

        $this->assertSame(['2026-08-21', '2026-08-22'], $keys);
    }

    public function test_midnight_crossover_window_match(): void
    {
        $task = $this->task([
            'date' => '2026-08-22',
            'deadlineTime' => '00:15',
        ]);

        $this->assertTrue($this->checker->isInDueSoonWindow(
            $task,
            $this->tokyo('2026-08-21 23:45:00'),
        ));
    }

    public function test_same_day_candidate_date(): void
    {
        $keys = $this->checker->candidateDateKeys($this->tokyo('2026-08-21 17:30:00'));

        $this->assertSame(['2026-08-21'], $keys);
    }

    public function test_deadline_interpreted_as_asia_tokyo_not_utc(): void
    {
        $deadline = $this->checker->deadlineDateTime('2026-08-21', '18:00');

        $this->assertNotNull($deadline);
        $this->assertSame('Asia/Tokyo', $deadline->getTimezone()->getName());
        $this->assertSame('2026-08-21 18:00:00', $deadline->format('Y-m-d H:i:s'));
    }

    public function test_each_occurrence_evaluated_separately(): void
    {
        $a = $this->task([
            'id' => 'occ-1',
            'date' => '2026-08-21',
            'deadlineTime' => '18:00',
            'recurrenceGroupId' => 'group-1',
        ]);
        $b = $this->task([
            'id' => 'occ-2',
            'date' => '2026-08-22',
            'deadlineTime' => '18:00',
            'recurrenceGroupId' => 'group-1',
        ]);

        $now = $this->tokyo('2026-08-21 17:30:00');

        $this->assertTrue($this->checker->isInDueSoonWindow($a, $now));
        $this->assertFalse($this->checker->isInDueSoonWindow($b, $now));
    }

    public function test_run_calls_notify_only_for_window_matches(): void
    {
        $matching = $this->task(['id' => 'match', 'deadlineTime' => '18:00']);
        $early = $this->task(['id' => 'early', 'deadlineTime' => '20:00']);

        $firestore = Mockery::mock(FirestoreService::class);
        $firestore->shouldReceive('isConfigured')->andReturn(false);

        $notifications = Mockery::mock(NotificationService::class);
        $notifications->shouldReceive('notifyTaskDueSoon')
            ->never();

        $checker = new DueSoonNotificationChecker($firestore, $notifications);
        $result = $checker->run($this->tokyo('2026-08-21 17:30:00'));

        $this->assertSame(0, $result['created']);
        $this->assertSame(0, $result['checked']);

        // Logic-only: matching is in window, early is not
        $this->assertTrue($checker->isInDueSoonWindow($matching, $this->tokyo('2026-08-21 17:30:00')));
        $this->assertFalse($checker->isInDueSoonWindow($early, $this->tokyo('2026-08-21 17:30:00')));
    }
}
