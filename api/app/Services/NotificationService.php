<?php

namespace App\Services;

use App\Data\NotificationData;
use App\Data\TaskData;
use App\Exceptions\NotificationServiceException;
use Google\Cloud\Core\Timestamp;
use Google\Cloud\Firestore\DocumentSnapshot;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Creates and manages in-app notifications.
 * Push delivery (Web / mobile) should hook here later — keep UI out of this layer.
 */
class NotificationService
{
    private const COLLECTION = 'notifications';

    private const LIST_LIMIT = 50;

    public const EVENT_CREATED = 'notification.created';

    public const EVENT_READ = 'notification.read';

    public const EVENT_READ_ALL = 'notification.read_all';

    public function __construct(
        private readonly FirestoreService $firestore,
        private readonly UserProfileService $profiles,
        private readonly NotificationBroadcaster $broadcaster,
    ) {}

    /**
     * @return list<NotificationData>
     */
    public function listForUser(string $userId, int $limit = self::LIST_LIMIT): array
    {
        try {
            $client = $this->firestore->getClient();
            $notifications = [];

            foreach (
                $client->collection(self::COLLECTION)
                    ->where('userId', '=', $userId)
                    ->documents() as $document
            ) {
                if ($document->exists()) {
                    $notifications[] = $this->mapSnapshot($document);
                }
            }

            usort(
                $notifications,
                static fn (NotificationData $a, NotificationData $b): int => strcmp($b->createdAt, $a->createdAt),
            );

            return array_slice($notifications, 0, max(1, min($limit, 100)));
        } catch (Throwable $e) {
            Log::error('Notification list failed', [
                'userId' => $userId,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw new NotificationServiceException('通知一覧を取得できませんでした');
        }
    }

    public function markRead(string $userId, string $notificationId): NotificationData
    {
        $notification = $this->findOwnedOrFail($userId, $notificationId);

        if ($notification->readAt !== null) {
            return $notification;
        }

        $now = new Timestamp(new \DateTimeImmutable);

        try {
            $this->notificationReference($notificationId)->update([
                ['path' => 'readAt', 'value' => $now],
                ['path' => 'updatedAt', 'value' => $now],
            ]);
        } catch (Throwable $e) {
            Log::error('Notification mark read failed', [
                'notificationId' => $notificationId,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw new NotificationServiceException('通知を既読にできませんでした');
        }

        $updated = $this->findById($notificationId);

        if ($updated === null) {
            throw new NotificationServiceException('通知を既読にできませんでした');
        }

        $this->broadcaster->dispatch(
            $userId,
            self::EVENT_READ,
            $notificationId,
            $now->get(),
        );

        return $updated;
    }

    /**
     * @return array{updatedCount: int}
     */
    public function markAllRead(string $userId): array
    {
        $notifications = $this->listForUser($userId, 100);
        $unread = array_values(array_filter(
            $notifications,
            static fn (NotificationData $n): bool => $n->readAt === null,
        ));

        if ($unread === []) {
            return ['updatedCount' => 0];
        }

        $now = new Timestamp(new \DateTimeImmutable);
        $updatedCount = 0;

        try {
            foreach ($unread as $notification) {
                $this->notificationReference($notification->id)->update([
                    ['path' => 'readAt', 'value' => $now],
                    ['path' => 'updatedAt', 'value' => $now],
                ]);
                $updatedCount++;
            }
        } catch (Throwable $e) {
            Log::error('Notification mark all read failed', [
                'userId' => $userId,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            throw new NotificationServiceException('通知を既読にできませんでした');
        }

        $this->broadcaster->dispatch(
            $userId,
            self::EVENT_READ_ALL,
            null,
            $now->get(),
        );

        return ['updatedCount' => $updatedCount];
    }

    /**
     * After a request task is successfully created.
     * Skips personal / self-assigned tasks.
     */
    public function notifyTaskAssigned(TaskData $task): ?NotificationData
    {
        if (! $this->shouldNotifyAssigned($task)) {
            return null;
        }

        $actorId = $task->requesterId;
        $actorName = $this->resolveDisplayName($actorId);

        return $this->createNotification([
            'userId' => $task->assigneeId,
            'familyId' => $task->familyId,
            'type' => NotificationData::TYPE_TASK_ASSIGNED,
            'taskId' => $task->id,
            'actorUserId' => $actorId,
            'title' => $actorName.'からタスクが届きました',
            'message' => '「'.$task->title.'」',
            'taskDate' => $task->date,
            'dedupeKey' => 'task.assigned:'.$task->id,
        ]);
    }

    /**
     * After incomplete → complete transition succeeds.
     * Skips personal tasks (requester missing or same as assignee).
     */
    public function notifyTaskCompleted(TaskData $task, bool $wasCompleted): ?NotificationData
    {
        if (! $this->shouldNotifyCompleted($task, $wasCompleted)) {
            return null;
        }

        $actorId = $task->assigneeId;
        $actorName = $this->resolveDisplayName($actorId);
        $requesterId = $task->requesterId;

        return $this->createNotification([
            'userId' => $requesterId,
            'familyId' => $task->familyId,
            'type' => NotificationData::TYPE_TASK_COMPLETED,
            'taskId' => $task->id,
            'actorUserId' => $actorId,
            'title' => $actorName.'さんが「'.$task->title.'」を完了しました',
            'message' => '',
            'taskDate' => $task->date,
            'dedupeKey' => 'task.completed:'.$task->id.':'.($task->completedAt ?? $task->updatedAt),
        ]);
    }

    /**
     * Phase 8-2 entry point: due-soon notifications.
     * Not scheduled in Phase 8-1.
     */
    public function notifyTaskDueSoon(TaskData $task): ?NotificationData
    {
        if ($task->completed || $task->deadlineTime === null || $task->assigneeId === '') {
            return null;
        }

        $dedupeKey = 'task.due_soon:'.$task->id.':'.$task->date.':'.$task->deadlineTime;

        if ($this->existsByDedupeKey($dedupeKey)) {
            return null;
        }

        return $this->createNotification([
            'userId' => $task->assigneeId,
            'familyId' => $task->familyId,
            'type' => NotificationData::TYPE_TASK_DUE_SOON,
            'taskId' => $task->id,
            'actorUserId' => null,
            'title' => '「'.$task->title.'」の締切が近づいています',
            'message' => '締切 '.$task->deadlineTime,
            'taskDate' => $task->date,
            'dedupeKey' => $dedupeKey,
        ]);
    }

    public function shouldNotifyAssigned(TaskData $task): bool
    {
        if ($task->requesterId === null || $task->requesterId === '') {
            return false;
        }

        return $task->requesterId !== $task->assigneeId;
    }

    public function shouldNotifyCompleted(TaskData $task, bool $wasCompleted): bool
    {
        if ($wasCompleted || ! $task->completed) {
            return false;
        }

        if ($task->requesterId === null || $task->requesterId === '') {
            return false;
        }

        return $task->requesterId !== $task->assigneeId;
    }

    /**
     * @param  array{
     *   userId: string,
     *   familyId: string,
     *   type: string,
     *   taskId: string,
     *   actorUserId: ?string,
     *   title: string,
     *   message: string,
     *   taskDate: ?string,
     *   dedupeKey: ?string
     * }  $input
     */
    public function createNotification(array $input): ?NotificationData
    {
        $dedupeKey = $input['dedupeKey'] ?? null;
        if (is_string($dedupeKey) && $dedupeKey !== '' && $this->existsByDedupeKey($dedupeKey)) {
            return null;
        }

        $id = (string) Str::uuid();
        $now = new Timestamp(new \DateTimeImmutable);

        $document = [
            'id' => $id,
            'userId' => $input['userId'],
            'familyId' => $input['familyId'],
            'type' => $input['type'],
            'taskId' => $input['taskId'],
            'actorUserId' => $input['actorUserId'],
            'title' => $input['title'],
            'message' => $input['message'],
            'taskDate' => $input['taskDate'],
            'readAt' => null,
            'createdAt' => $now,
            'updatedAt' => $now,
            'dedupeKey' => $dedupeKey,
        ];

        try {
            $payload = $document;
            unset($payload['id']);
            $this->firestore->getClient()
                ->collection(self::COLLECTION)
                ->document($id)
                ->set($payload);
        } catch (Throwable $e) {
            Log::error('Notification create failed', [
                'userId' => $input['userId'],
                'type' => $input['type'],
                'taskId' => $input['taskId'],
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);

            // Task write already succeeded; do not fail the parent operation.
            return null;
        }

        $created = NotificationData::fromFirestore($id, array_merge($document, [
            'createdAt' => $now,
            'updatedAt' => $now,
            'readAt' => null,
        ]));

        $this->broadcaster->dispatch(
            $created->userId,
            self::EVENT_CREATED,
            $created->id,
            $now->get(),
        );

        return $created;
    }

    private function resolveDisplayName(?string $userId): string
    {
        if ($userId === null || $userId === '') {
            return 'メンバー';
        }

        try {
            $profile = $this->profiles->findByUid($userId);
            $name = $profile?->displayName;

            if (is_string($name) && trim($name) !== '') {
                return trim($name);
            }
        } catch (Throwable) {
            // fall through
        }

        return 'メンバー';
    }

    private function existsByDedupeKey(string $dedupeKey): bool
    {
        try {
            $documents = $this->firestore->getClient()
                ->collection(self::COLLECTION)
                ->where('dedupeKey', '=', $dedupeKey)
                ->limit(1)
                ->documents();

            foreach ($documents as $document) {
                if ($document->exists()) {
                    return true;
                }
            }
        } catch (Throwable $e) {
            Log::warning('Notification dedupe lookup failed', [
                'dedupeKey' => $dedupeKey,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);
        }

        return false;
    }

    private function findOwnedOrFail(string $userId, string $notificationId): NotificationData
    {
        $notification = $this->findById($notificationId);

        if ($notification === null) {
            throw new NotificationServiceException('通知が見つかりません', 404);
        }

        if ($notification->userId !== $userId) {
            throw new NotificationServiceException('この通知にアクセスできません', 403);
        }

        return $notification;
    }

    private function findById(string $notificationId): ?NotificationData
    {
        try {
            $snapshot = $this->notificationReference($notificationId)->snapshot();

            if (! $snapshot->exists()) {
                return null;
            }

            return $this->mapSnapshot($snapshot);
        } catch (NotificationServiceException $e) {
            throw $e;
        } catch (Throwable) {
            throw new NotificationServiceException('通知情報を取得できませんでした');
        }
    }

    private function mapSnapshot(DocumentSnapshot $snapshot): NotificationData
    {
        /** @var array<string, mixed> $data */
        $data = $snapshot->data() ?? [];

        return NotificationData::fromFirestore($snapshot->id(), $data);
    }

    private function notificationReference(string $notificationId): \Google\Cloud\Firestore\DocumentReference
    {
        return $this->firestore->getClient()
            ->collection(self::COLLECTION)
            ->document($notificationId);
    }
}
