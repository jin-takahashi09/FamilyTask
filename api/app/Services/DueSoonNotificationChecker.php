<?php

namespace App\Services;

use App\Data\TaskData;
use DateTimeImmutable;
use DateTimeZone;
use Google\Cloud\Firestore\DocumentSnapshot;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Finds incomplete tasks whose deadline is ~30 minutes away (Asia/Tokyo)
 * and creates task.due_soon notifications via NotificationService.
 */
class DueSoonNotificationChecker
{
    public const TIMEZONE = 'Asia/Tokyo';

    /** Notify when this many minutes remain until the deadline. */
    public const MINUTES_BEFORE = 30;

    /**
     * Inclusive recovery window after the ideal notify time (minutes).
     * With a 5-minute scheduler, runs at T and T+5 both cover the same
     * deadline once; NotificationService dedupe prevents duplicates.
     */
    public const WINDOW_MINUTES = 5;

    public function __construct(
        private readonly FirestoreService $firestore,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * @return array{
     *   now: string,
     *   dateKeys: list<string>,
     *   checked: int,
     *   created: int,
     *   skipped: int
     * }
     */
    public function run(?DateTimeImmutable $now = null): array
    {
        $now = $this->normalizeNow($now);
        $dateKeys = $this->candidateDateKeys($now);
        $checked = 0;
        $created = 0;
        $skipped = 0;

        foreach ($this->fetchIncompleteTasksForDates($dateKeys) as $task) {
            $checked++;

            if (! $this->isInDueSoonWindow($task, $now)) {
                $skipped++;

                continue;
            }

            try {
                $notification = $this->notifications->notifyTaskDueSoon($task);
                if ($notification !== null) {
                    $created++;
                } else {
                    $skipped++;
                }
            } catch (Throwable $e) {
                $skipped++;
                Log::warning('Due-soon notification failed', [
                    'taskId' => $task->id,
                    'exceptionClass' => $e::class,
                    'exceptionMessage' => $e->getMessage(),
                ]);
            }
        }

        return [
            'now' => $now->format(DateTimeImmutable::ATOM),
            'dateKeys' => $dateKeys,
            'checked' => $checked,
            'created' => $created,
            'skipped' => $skipped,
        ];
    }

    public function normalizeNow(?DateTimeImmutable $now = null): DateTimeImmutable
    {
        $tz = new DateTimeZone(self::TIMEZONE);

        if ($now === null) {
            return new DateTimeImmutable('now', $tz);
        }

        return $now->setTimezone($tz);
    }

    /**
     * Dates that may contain deadlines in the due-soon window
     * [now+25min, now+30min] (Asia/Tokyo). Covers midnight crossover.
     *
     * @return list<string>
     */
    public function candidateDateKeys(DateTimeImmutable $now): array
    {
        $now = $this->normalizeNow($now);
        $earliestDeadline = $now->modify('+'.(self::MINUTES_BEFORE - self::WINDOW_MINUTES).' minutes');
        $latestDeadline = $now->modify('+'.self::MINUTES_BEFORE.' minutes');

        $keys = [
            $earliestDeadline->format('Y-m-d'),
            $latestDeadline->format('Y-m-d'),
        ];

        return array_values(array_unique($keys));
    }

    /**
     * True when remaining time until deadline is in [25, 30] minutes (inclusive).
     */
    public function isInDueSoonWindow(TaskData $task, DateTimeImmutable $now): bool
    {
        if ($task->completed) {
            return false;
        }

        if ($task->deadlineTime === null || $task->deadlineTime === '') {
            return false;
        }

        if ($task->assigneeId === '') {
            return false;
        }

        if ($task->date === '') {
            return false;
        }

        $deadline = $this->deadlineDateTime($task->date, $task->deadlineTime);
        if ($deadline === null) {
            return false;
        }

        $now = $this->normalizeNow($now);
        $secondsUntil = $deadline->getTimestamp() - $now->getTimestamp();
        $maxSeconds = self::MINUTES_BEFORE * 60;
        $minSeconds = (self::MINUTES_BEFORE - self::WINDOW_MINUTES) * 60;

        return $secondsUntil >= $minSeconds && $secondsUntil <= $maxSeconds;
    }

    public function deadlineDateTime(string $date, string $deadlineTime): ?DateTimeImmutable
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return null;
        }

        if (! preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $deadlineTime)) {
            return null;
        }

        $tz = new DateTimeZone(self::TIMEZONE);
        $deadline = DateTimeImmutable::createFromFormat(
            '!Y-m-d H:i',
            $date.' '.$deadlineTime,
            $tz,
        );

        if ($deadline === false) {
            return null;
        }

        return $deadline;
    }

    /**
     * @param  list<string>  $dateKeys
     * @return list<TaskData>
     */
    private function fetchIncompleteTasksForDates(array $dateKeys): array
    {
        if ($dateKeys === [] || ! $this->firestore->isConfigured()) {
            return [];
        }

        try {
            $client = $this->firestore->getClient();
            $tasks = [];

            foreach ($dateKeys as $dateKey) {
                foreach (
                    $client->collection('tasks')
                        ->where('date', '=', $dateKey)
                        ->documents() as $document
                ) {
                    if (! $document->exists()) {
                        continue;
                    }

                    $task = $this->mapSnapshot($document);
                    if ($task->completed) {
                        continue;
                    }

                    if ($task->deadlineTime === null || $task->assigneeId === '') {
                        continue;
                    }

                    $tasks[] = $task;
                }
            }

            return $tasks;
        } catch (Throwable $e) {
            Log::error('Due-soon task query failed', [
                'dateKeys' => $dateKeys,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            return [];
        }
    }

    private function mapSnapshot(DocumentSnapshot $snapshot): TaskData
    {
        /** @var array<string, mixed> $data */
        $data = $snapshot->data() ?? [];

        return TaskData::fromFirestore($snapshot->id(), $data);
    }
}
