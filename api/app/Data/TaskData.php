<?php

namespace App\Data;

readonly class TaskData
{
    public function __construct(
        public string $id,
        public string $familyId,
        public string $date,
        public string $title,
        public ?string $requesterId,
        public string $assigneeId,
        public ?string $deadlineTime,
        public bool $completed,
        public bool $alarmEnabled,
        public bool $notifyOnComplete,
        public string $repeatType,
        public ?int $repeatWeekday,
        public ?string $repeatEndDate,
        public ?string $recurrenceGroupId,
        public string $createdBy,
        public string $createdAt,
        public string $updatedAt,
        public ?string $completedAt = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromFirestore(string $id, array $data): self
    {
        $repeatWeekday = $data['repeatWeekday'] ?? null;

        return new self(
            id: $id,
            familyId: (string) ($data['familyId'] ?? ''),
            date: (string) ($data['date'] ?? ''),
            title: (string) ($data['title'] ?? ''),
            requesterId: isset($data['requesterId']) && $data['requesterId'] !== ''
                ? (string) $data['requesterId']
                : null,
            assigneeId: (string) ($data['assigneeId'] ?? ''),
            deadlineTime: isset($data['deadlineTime']) && $data['deadlineTime'] !== ''
                ? (string) $data['deadlineTime']
                : null,
            completed: (bool) ($data['completed'] ?? false),
            alarmEnabled: ($data['alarmEnabled'] ?? true) !== false,
            notifyOnComplete: (bool) ($data['notifyOnComplete'] ?? false),
            repeatType: (string) ($data['repeatType'] ?? 'none'),
            repeatWeekday: is_numeric($repeatWeekday) ? (int) $repeatWeekday : null,
            repeatEndDate: isset($data['repeatEndDate']) && $data['repeatEndDate'] !== ''
                ? (string) $data['repeatEndDate']
                : null,
            recurrenceGroupId: isset($data['recurrenceGroupId']) && $data['recurrenceGroupId'] !== ''
                ? (string) $data['recurrenceGroupId']
                : null,
            createdBy: (string) ($data['createdBy'] ?? ''),
            createdAt: FirestoreTimestamps::toIso8601($data['createdAt'] ?? null),
            updatedAt: FirestoreTimestamps::toIso8601($data['updatedAt'] ?? null),
            completedAt: isset($data['completedAt']) && $data['completedAt'] !== null
                ? FirestoreTimestamps::toIso8601($data['completedAt'])
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
            'familyId' => $this->familyId,
            'date' => $this->date,
            'title' => $this->title,
            'requesterId' => $this->requesterId,
            'assigneeId' => $this->assigneeId,
            'deadlineTime' => $this->deadlineTime,
            'completed' => $this->completed,
            'alarmEnabled' => $this->alarmEnabled,
            'notifyOnComplete' => $this->notifyOnComplete,
            'createdAt' => $this->createdAt,
            'repeatType' => $this->repeatType,
            'repeatWeekday' => $this->repeatWeekday,
            'repeatEndDate' => $this->repeatEndDate,
            'recurrenceGroupId' => $this->recurrenceGroupId,
        ];
    }
}
