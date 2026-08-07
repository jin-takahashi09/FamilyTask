<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Notifies family members that Firestore-backed data changed.
 * Payload is intentionally minimal; clients refetch via existing APIs.
 */
class FamilySyncUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public readonly string $familyId,
        public readonly string $eventType,
        public readonly string $updatedAt,
    ) {}

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('family.'.$this->familyId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'family.sync';
    }

    /**
     * @return array{familyId: string, eventType: string, updatedAt: string}
     */
    public function broadcastWith(): array
    {
        return [
            'familyId' => $this->familyId,
            'eventType' => $this->eventType,
            'updatedAt' => $this->updatedAt,
        ];
    }
}
