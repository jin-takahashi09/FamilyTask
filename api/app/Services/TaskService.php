<?php

namespace App\Services;

use App\Data\TaskData;
use App\Exceptions\TaskServiceException;
use Google\Cloud\Core\Timestamp;
use Google\Cloud\Firestore\DocumentSnapshot;
use Google\Cloud\Firestore\FirestoreClient;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class TaskService
{
    private const COLLECTION = 'tasks';

    private const BATCH_WRITE_LIMIT = 450;

    public function __construct(
        private readonly FirestoreService $firestore,
        private readonly MembershipService $memberships,
        private readonly TaskRecurrenceService $recurrence,
    ) {}

    /**
     * @return list<TaskData>
     */
    public function listForFamily(
        string $userId,
        string $familyId,
        ?string $date = null,
        ?string $assigneeId = null,
        ?bool $completed = null,
    ): array {
        $this->memberships->requireMembership($userId, $familyId);

        try {
            $client = $this->client();
            $query = $client->collection(self::COLLECTION)
                ->where('familyId', '=', $familyId);

            if ($date !== null) {
                $query = $query->where('date', '=', $date);
            }

            if ($assigneeId !== null) {
                $query = $query->where('assigneeId', '=', $assigneeId);
            }

            if ($completed !== null) {
                $query = $query->where('completed', '=', $completed);
            }

            $tasks = [];

            foreach ($query->documents() as $document) {
                if ($document->exists()) {
                    $task = $this->mapSnapshot($document);
                    if ($task->familyId === $familyId) {
                        $tasks[] = $task;
                    }
                }
            }

            return $tasks;
        } catch (TaskServiceException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Task list failed', [
                'familyId' => $familyId,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw new TaskServiceException('タスク一覧を取得できませんでした');
        }
    }

    public function getForMember(string $userId, string $familyId, string $taskId): TaskData
    {
        $this->memberships->requireMembership($userId, $familyId);
        $task = $this->findById($taskId);

        if ($task === null || $task->familyId !== $familyId) {
            throw new TaskServiceException('タスクが見つかりません', 404);
        }

        return $task;
    }

    /**
     * @param  array<string, mixed>  $input
     * @return list<TaskData>
     */
    public function create(string $userId, string $familyId, array $input): array
    {
        $this->memberships->requireMembership($userId, $familyId);

        $title = $this->normalizeTitle($input['title'] ?? '');
        $date = (string) ($input['date'] ?? '');
        $this->assertValidDate($date);

        $taskType = (string) ($input['taskType'] ?? 'personal');
        $assigneeId = (string) ($input['assigneeId'] ?? '');
        $this->assertMemberOfFamily($assigneeId, $familyId);

        $requesterId = $taskType === 'request' ? $userId : null;

        if ($taskType === 'personal' && $assigneeId !== $userId) {
            throw new TaskServiceException('自分用タスクの担当者が不正です', 422);
        }

        if ($taskType === 'request' && $assigneeId === $userId) {
            throw new TaskServiceException('家族依頼の担当者が不正です', 422);
        }

        $repeatType = (string) ($input['repeatType'] ?? 'none');
        $this->assertValidRepeatType($repeatType);

        $repeatWeekday = $input['repeatWeekday'] ?? null;
        if ($repeatType === 'weekly') {
            if (! is_int($repeatWeekday) || $repeatWeekday < 0 || $repeatWeekday > 6) {
                throw new TaskServiceException('繰り返し曜日が不正です', 422);
            }
        } else {
            $repeatWeekday = null;
        }

        $repeatEndDate = isset($input['repeatEndDate']) && $input['repeatEndDate'] !== ''
            ? (string) $input['repeatEndDate']
            : null;

        if ($repeatEndDate !== null) {
            $this->assertValidDate($repeatEndDate);
            $endError = $this->recurrence->validateRepeatEndDate($date, $repeatEndDate);
            if ($endError !== null) {
                throw new TaskServiceException($endError, 422);
            }
        }

        $deadlineTime = $this->normalizeDeadlineTime($input['deadlineTime'] ?? null);
        $alarmEnabled = ($input['alarmEnabled'] ?? true) !== false;
        $notifyOnComplete = $taskType === 'request' && ($input['notifyOnComplete'] ?? false) === true;

        $dates = $this->recurrence->generateRecurringDates(
            $date,
            $repeatType,
            $repeatEndDate,
            $repeatWeekday,
        );

        if ($dates === []) {
            throw new TaskServiceException('タスクを作成できませんでした', 422);
        }

        $recurrenceGroupId = $repeatType === 'none' ? null : (string) Str::uuid();
        $now = new Timestamp(new \DateTimeImmutable);

        $documents = [];

        foreach ($dates as $occurrenceDate) {
            $documents[] = [
                'id' => (string) Str::uuid(),
                'familyId' => $familyId,
                'date' => $occurrenceDate,
                'title' => $title,
                'requesterId' => $requesterId,
                'assigneeId' => $assigneeId,
                'deadlineTime' => $deadlineTime,
                'completed' => false,
                'alarmEnabled' => $alarmEnabled,
                'notifyOnComplete' => $notifyOnComplete,
                'repeatType' => $repeatType,
                'repeatWeekday' => $repeatWeekday,
                'repeatEndDate' => $repeatEndDate,
                'recurrenceGroupId' => $recurrenceGroupId,
                'createdBy' => $userId,
                'createdAt' => $now,
                'updatedAt' => $now,
                'completedAt' => null,
            ];
        }

        try {
            $this->commitTaskCreates($documents);

            return array_map(
                fn (array $doc) => TaskData::fromFirestore($doc['id'], $doc),
                $documents,
            );
        } catch (TaskServiceException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Task create failed', [
                'familyId' => $familyId,
                'count' => count($documents),
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw new TaskServiceException('タスクを作成できませんでした');
        }
    }

    /**
     * @param  array<string, mixed>  $input
     */
    public function update(string $userId, string $familyId, string $taskId, array $input): TaskData
    {
        $this->memberships->requireMembership($userId, $familyId);
        $existing = $this->getForMember($userId, $familyId, $taskId);

        $updates = [];
        $now = new Timestamp(new \DateTimeImmutable);

        if (array_key_exists('title', $input)) {
            $updates[] = ['path' => 'title', 'value' => $this->normalizeTitle($input['title'])];
        }

        if (array_key_exists('deadlineTime', $input)) {
            $updates[] = [
                'path' => 'deadlineTime',
                'value' => $this->normalizeDeadlineTime($input['deadlineTime']),
            ];
        }

        if (array_key_exists('alarmEnabled', $input)) {
            $updates[] = ['path' => 'alarmEnabled', 'value' => (bool) $input['alarmEnabled']];
        }

        if (array_key_exists('notifyOnComplete', $input)) {
            $updates[] = ['path' => 'notifyOnComplete', 'value' => (bool) $input['notifyOnComplete']];
        }

        if (array_key_exists('assigneeId', $input)) {
            $assigneeId = (string) $input['assigneeId'];
            $this->assertMemberOfFamily($assigneeId, $familyId);
            $updates[] = ['path' => 'assigneeId', 'value' => $assigneeId];
        }

        if (array_key_exists('completed', $input)) {
            $completed = (bool) $input['completed'];
            $updates[] = ['path' => 'completed', 'value' => $completed];
            $updates[] = [
                'path' => 'completedAt',
                'value' => $completed ? $now : null,
            ];
        }

        if ($updates === []) {
            return $existing;
        }

        $updates[] = ['path' => 'updatedAt', 'value' => $now];

        try {
            $this->taskReference($taskId)->update($updates);
        } catch (TaskServiceException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Task update failed', [
                'taskId' => $taskId,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw new TaskServiceException('タスクを更新できませんでした');
        }

        $updated = $this->findById($taskId);

        if ($updated === null) {
            throw new TaskServiceException('タスクを更新できませんでした');
        }

        return $updated;
    }

    public function setCompleted(
        string $userId,
        string $familyId,
        string $taskId,
        bool $completed,
    ): TaskData {
        return $this->update($userId, $familyId, $taskId, ['completed' => $completed]);
    }

    public function delete(string $userId, string $familyId, string $taskId): void
    {
        $this->getForMember($userId, $familyId, $taskId);

        try {
            $ref = $this->taskReference($taskId);
            if ($ref->snapshot()->exists()) {
                $ref->delete();
            }
        } catch (TaskServiceException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Task delete failed', [
                'taskId' => $taskId,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw new TaskServiceException('タスクを削除できませんでした');
        }
    }

    /**
     * @param  array<string, mixed>  $input
     */
    public function deleteRecurrence(
        string $userId,
        string $familyId,
        string $recurrenceGroupId,
        array $input,
    ): void {
        $this->memberships->requireMembership($userId, $familyId);

        $scope = (string) ($input['scope'] ?? '');
        if (! in_array($scope, ['single', 'future', 'all'], true)) {
            throw new TaskServiceException('削除範囲が不正です', 422);
        }

        $tasks = $this->listByRecurrenceGroup($familyId, $recurrenceGroupId);

        if ($tasks === []) {
            return;
        }

        $targetIds = match ($scope) {
            'single' => $this->filterSingleScope($tasks, (string) ($input['taskId'] ?? '')),
            'future' => $this->filterFutureScope($tasks, (string) ($input['fromDate'] ?? '')),
            'all' => array_map(static fn (TaskData $task) => $task->id, $tasks),
        };

        if ($targetIds === []) {
            throw new TaskServiceException('削除対象のタスクが見つかりません', 404);
        }

        try {
            $this->commitTaskDeletes($targetIds);
        } catch (TaskServiceException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Recurrence delete failed', [
                'familyId' => $familyId,
                'recurrenceGroupId' => $recurrenceGroupId,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw new TaskServiceException('タスクを削除できませんでした');
        }
    }

    /**
     * @param  list<array<string, mixed>>  $documents
     */
    private function commitTaskCreates(array $documents): void
    {
        $client = $this->client();

        foreach (array_chunk($documents, self::BATCH_WRITE_LIMIT) as $chunk) {
            try {
                $batch = $client->bulkWriter();

                foreach ($chunk as $document) {
                    $id = $document['id'];
                    unset($document['id']);
                    $batch->set(
                        $client->collection(self::COLLECTION)->document($id),
                        $document,
                    );
                }

                $batch->commit();
            } catch (Throwable $batchError) {
                Log::warning('Task create batch failed; falling back to individual creates', [
                    'documentCount' => count($chunk),
                    'exceptionClass' => $batchError::class,
                    'exceptionMessage' => $batchError->getMessage(),
                ]);

                foreach ($chunk as $document) {
                    $id = $document['id'];
                    unset($document['id']);
                    $client->collection(self::COLLECTION)->document($id)->set($document);
                }
            }
        }
    }

    /**
     * @param  list<string>  $taskIds
     */
    private function commitTaskDeletes(array $taskIds): void
    {
        $client = $this->client();
        $refs = array_map(
            fn (string $taskId) => $client->collection(self::COLLECTION)->document($taskId),
            $taskIds,
        );

        foreach (array_chunk($refs, self::BATCH_WRITE_LIMIT) as $chunk) {
            try {
                $batch = $client->bulkWriter();

                foreach ($chunk as $ref) {
                    $batch->delete($ref);
                }

                $batch->commit();
            } catch (Throwable $batchError) {
                Log::warning('Task delete batch failed; falling back to individual deletes', [
                    'documentCount' => count($chunk),
                    'exceptionClass' => $batchError::class,
                    'exceptionMessage' => $batchError->getMessage(),
                ]);

                foreach ($chunk as $ref) {
                    if ($ref->snapshot()->exists()) {
                        $ref->delete();
                    }
                }
            }
        }
    }

    /**
     * @return list<TaskData>
     */
    private function listByRecurrenceGroup(string $familyId, string $recurrenceGroupId): array
    {
        $client = $this->client();
        $tasks = [];

        foreach (
            $client->collection(self::COLLECTION)
                ->where('familyId', '=', $familyId)
                ->where('recurrenceGroupId', '=', $recurrenceGroupId)
                ->documents() as $document
        ) {
            if ($document->exists()) {
                $tasks[] = $this->mapSnapshot($document);
            }
        }

        return $tasks;
    }

    /**
     * @param  list<TaskData>  $tasks
     * @return list<string>
     */
    private function filterSingleScope(array $tasks, string $taskId): array
    {
        if ($taskId === '') {
            throw new TaskServiceException('削除対象のタスクが見つかりません', 422);
        }

        foreach ($tasks as $task) {
            if ($task->id === $taskId) {
                return [$taskId];
            }
        }

        throw new TaskServiceException('削除対象のタスクが見つかりません', 404);
    }

    /**
     * @param  list<TaskData>  $tasks
     * @return list<string>
     */
    private function filterFutureScope(array $tasks, string $fromDate): array
    {
        if ($fromDate === '') {
            throw new TaskServiceException('削除開始日が不正です', 422);
        }

        $this->assertValidDate($fromDate);

        return array_values(array_map(
            static fn (TaskData $task) => $task->id,
            array_filter(
                $tasks,
                static fn (TaskData $task) => $task->date >= $fromDate,
            ),
        ));
    }

    private function findById(string $taskId): ?TaskData
    {
        try {
            $snapshot = $this->taskReference($taskId)->snapshot();

            if (! $snapshot->exists()) {
                return null;
            }

            return $this->mapSnapshot($snapshot);
        } catch (TaskServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new TaskServiceException('タスク情報を取得できませんでした');
        }
    }

    private function assertMemberOfFamily(string $userId, string $familyId): void
    {
        if ($userId === '') {
            throw new TaskServiceException('担当者が不正です', 422);
        }

        if (! $this->memberships->isMember($userId, $familyId)) {
            throw new TaskServiceException('担当者が家族グループに所属していません', 422);
        }
    }

    private function normalizeTitle(mixed $title): string
    {
        if (! is_string($title)) {
            throw new TaskServiceException('タスク名を入力してください', 422);
        }

        $normalized = trim($title);

        if ($normalized === '') {
            throw new TaskServiceException('タスク名を入力してください', 422);
        }

        if (mb_strlen($normalized) > 100) {
            throw new TaskServiceException('タスク名は100文字以内で入力してください', 422);
        }

        if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', $normalized) === 1) {
            throw new TaskServiceException('タスク名に使用できない文字が含まれています', 422);
        }

        return $normalized;
    }

    private function assertValidDate(string $date): void
    {
        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);

        if ($parsed === false || $parsed->format('Y-m-d') !== $date) {
            throw new TaskServiceException('日付が不正です', 422);
        }
    }

    private function assertValidRepeatType(string $repeatType): void
    {
        if (! in_array($repeatType, ['none', 'daily', 'weekly', 'monthly', 'yearly'], true)) {
            throw new TaskServiceException('繰り返し設定が不正です', 422);
        }
    }

    private function normalizeDeadlineTime(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_string($value) || ! preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $value)) {
            throw new TaskServiceException('締切時間が不正です', 422);
        }

        return $value;
    }

    private function taskReference(string $taskId): \Google\Cloud\Firestore\DocumentReference
    {
        return $this->client()
            ->collection(self::COLLECTION)
            ->document($taskId);
    }

    private function client(): FirestoreClient
    {
        if (! $this->firestore->isConfigured()) {
            throw new TaskServiceException('Firestore is not configured.');
        }

        return $this->firestore->getClient();
    }

    private function mapSnapshot(DocumentSnapshot $snapshot): TaskData
    {
        /** @var array<string, mixed> $data */
        $data = $snapshot->data() ?? [];

        return TaskData::fromFirestore($snapshot->id(), $data);
    }
}
