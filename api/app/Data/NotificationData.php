<?php

namespace App\Data;

readonly class NotificationData
{
    public const TYPE_TASK_ASSIGNED = 'task.assigned';

    public const TYPE_TASK_DUE_SOON = 'task.due_soon';

    public const TYPE_TASK_COMPLETED = 'task.completed';

    public function __construct(
        public string $id,
        public string $userId,
        public string $familyId,
        public string $type,
        public string $taskId,
        public ?string $actorUserId,
        public string $title,
        public string $message,
        public ?string $taskDate,
        public ?string $readAt,
        public string $createdAt,
        public string $updatedAt,
        public ?string $dedupeKey = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromFirestore(string $id, array $data): self
    {
        return new self(
            id: $id,
            userId: (string) ($data['userId'] ?? ''),
            familyId: (string) ($data['familyId'] ?? ''),
            type: (string) ($data['type'] ?? ''),
            taskId: (string) ($data['taskId'] ?? ''),
            actorUserId: isset($data['actorUserId']) && $data['actorUserId'] !== ''
                ? (string) $data['actorUserId']
                : null,
            title: (string) ($data['title'] ?? ''),
            message: (string) ($data['message'] ?? ''),
            taskDate: isset($data['taskDate']) && $data['taskDate'] !== ''
                ? (string) $data['taskDate']
                : null,
            readAt: isset($data['readAt']) && $data['readAt'] !== null
                ? FirestoreTimestamps::toIso8601($data['readAt'])
                : null,
            createdAt: FirestoreTimestamps::toIso8601($data['createdAt'] ?? null),
            updatedAt: FirestoreTimestamps::toIso8601($data['updatedAt'] ?? null),
            dedupeKey: isset($data['dedupeKey']) && $data['dedupeKey'] !== ''
                ? (string) $data['dedupeKey']
                : null,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'userId' => $this->userId,
            'familyId' => $this->familyId,
            'type' => $this->type,
            'taskId' => $this->taskId,
            'actorUserId' => $this->actorUserId,
            'title' => $this->title,
            'message' => $this->message,
            'taskDate' => $this->taskDate,
            'readAt' => $this->readAt,
            'createdAt' => $this->createdAt,
            'updatedAt' => $this->updatedAt,
            'dedupeKey' => $this->dedupeKey,
        ];
    }
}
