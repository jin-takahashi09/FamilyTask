<?php

namespace Tests\Unit;

use App\Data\MembershipData;
use App\Events\FamilySyncUpdated;
use App\Services\FamilySyncBroadcaster;
use App\Services\MembershipService;
use App\Sync\FamilySyncEventType;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Mockery;
use Tests\TestCase;

class FamilySyncBroadcasterTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_dispatch_emits_family_sync_event_when_broadcasting_enabled(): void
    {
        config(['broadcasting.default' => 'log']);
        Event::fake([FamilySyncUpdated::class]);

        $memberships = Mockery::mock(MembershipService::class);
        $memberships->shouldNotReceive('listByUserId');

        $broadcaster = new FamilySyncBroadcaster($memberships);

        $broadcaster->dispatch('family-1', FamilySyncEventType::TaskCreated);

        Event::assertDispatched(FamilySyncUpdated::class, function (FamilySyncUpdated $event): bool {
            return $event->familyId === 'family-1'
                && $event->eventType === FamilySyncEventType::TaskCreated
                && $event->updatedAt !== '';
        });
    }

    public function test_dispatch_is_skipped_when_broadcasting_disabled(): void
    {
        config(['broadcasting.default' => 'null']);
        Event::fake([FamilySyncUpdated::class]);

        $memberships = Mockery::mock(MembershipService::class);
        $broadcaster = new FamilySyncBroadcaster($memberships);

        $broadcaster->dispatch('family-1', FamilySyncEventType::TaskDeleted);

        Event::assertNotDispatched(FamilySyncUpdated::class);
    }

    public function test_dispatch_for_user_memberships_emits_one_event_per_family(): void
    {
        config(['broadcasting.default' => 'log']);
        Event::fake([FamilySyncUpdated::class]);

        $memberships = Mockery::mock(MembershipService::class);
        $memberships->shouldReceive('listByUserId')
            ->once()
            ->with('user-1')
            ->andReturn([
                new MembershipData('m-1', 'family-a', 'user-1', 'member', '2026-08-07T00:00:00+00:00'),
                new MembershipData('m-2', 'family-b', 'user-1', 'owner', '2026-08-07T00:00:00+00:00'),
            ]);

        $broadcaster = new FamilySyncBroadcaster($memberships);
        $broadcaster->dispatchForUserMemberships('user-1', FamilySyncEventType::ProfileUpdated);

        Event::assertDispatchedTimes(FamilySyncUpdated::class, 2);
    }

    public function test_dispatch_uses_to_others_when_socket_id_present(): void
    {
        config(['broadcasting.default' => 'log']);

        $this->app->instance('request', request()->duplicate(
            server: ['HTTP_X-Socket-Id' => 'socket-123'],
        ));

        $pending = Mockery::mock(\Illuminate\Broadcasting\PendingBroadcast::class);
        $pending->shouldReceive('toOthers')->once()->andReturnSelf();

        Broadcast::shouldReceive('event')
            ->once()
            ->andReturn($pending);

        $memberships = Mockery::mock(MembershipService::class);
        $broadcaster = new FamilySyncBroadcaster($memberships);

        $broadcaster->dispatch('family-1', FamilySyncEventType::TaskUpdated);
    }

    public function test_dispatch_skips_to_others_without_socket_id(): void
    {
        config(['broadcasting.default' => 'log']);

        $pending = Mockery::mock(\Illuminate\Broadcasting\PendingBroadcast::class);
        $pending->shouldNotReceive('toOthers');

        Broadcast::shouldReceive('event')
            ->once()
            ->andReturn($pending);

        $memberships = Mockery::mock(MembershipService::class);
        $broadcaster = new FamilySyncBroadcaster($memberships);

        $broadcaster->dispatch('family-1', FamilySyncEventType::TaskCreated);
    }
}
