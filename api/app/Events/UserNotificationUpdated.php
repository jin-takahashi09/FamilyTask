<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Notifies a single user that their in-app notifications changed.
 * Payload is intentionally minimal; clients refetch via notification APIs.
 * Never broadcast full notification bodies on family channels.
 */
class UserNotificationUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly string $userId,
        public readonly string $eventType,
        public readonly string $updatedAt,
        public readonly ?string $notificationId = null,
    ) {}

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.'.$this->userId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'notification.updated';
    }

    /**
     * @return array{userId: string, eventType: string, updatedAt: string, notificationId: string|null}
     */
    public function broadcastWith(): array
    {
        return [
            'userId' => $this->userId,
            'eventType' => $this->eventType,
            'updatedAt' => $this->updatedAt,
            'notificationId' => $this->notificationId,
        ];
    }
}
