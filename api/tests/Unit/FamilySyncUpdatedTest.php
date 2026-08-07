<?php

namespace Tests\Unit;

use App\Events\FamilySyncUpdated;
use App\Sync\FamilySyncEventType;
use Illuminate\Broadcasting\PrivateChannel;
use Tests\TestCase;

class FamilySyncUpdatedTest extends TestCase
{
    public function test_broadcast_payload_contains_minimal_fields(): void
    {
        $event = new FamilySyncUpdated(
            familyId: 'family-1',
            eventType: FamilySyncEventType::TaskUpdated,
            updatedAt: '2026-08-07T12:00:00+00:00',
        );

        $this->assertSame([
            'familyId' => 'family-1',
            'eventType' => FamilySyncEventType::TaskUpdated,
            'updatedAt' => '2026-08-07T12:00:00+00:00',
        ], $event->broadcastWith());

        $this->assertSame('family.sync', $event->broadcastAs());
        $this->assertEquals([new PrivateChannel('family.family-1')], $event->broadcastOn());
    }
}
