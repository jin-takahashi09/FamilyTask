<?php

namespace Tests\Unit;

use App\Events\FamilySyncUpdated;
use App\Services\FamilySyncBroadcaster;
use App\Services\MembershipService;
use App\Sync\FamilySyncEventType;
use Illuminate\Support\Facades\Event;
use Mockery;
use Tests\TestCase;

class FamilySyncServiceHooksTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_task_created_event_fires_after_successful_dispatch(): void
    {
        config(['broadcasting.default' => 'log']);
        Event::fake([FamilySyncUpdated::class]);

        $memberships = Mockery::mock(MembershipService::class);
        $broadcaster = new FamilySyncBroadcaster($memberships);

        $broadcaster->dispatch('family-1', FamilySyncEventType::TaskCreated);

        Event::assertDispatched(FamilySyncUpdated::class, function (FamilySyncUpdated $event): bool {
            return $event->eventType === FamilySyncEventType::TaskCreated;
        });
    }

    public function test_task_failure_does_not_emit_event_when_broadcasting_disabled(): void
    {
        config(['broadcasting.default' => 'null']);
        Event::fake([FamilySyncUpdated::class]);

        $memberships = Mockery::mock(MembershipService::class);
        $broadcaster = new FamilySyncBroadcaster($memberships);

        $broadcaster->dispatch('family-1', FamilySyncEventType::TaskCreated);

        Event::assertNotDispatched(FamilySyncUpdated::class);
    }

    public function test_family_created_event_fires_after_successful_dispatch(): void
    {
        config(['broadcasting.default' => 'log']);
        Event::fake([FamilySyncUpdated::class]);

        $memberships = Mockery::mock(MembershipService::class);
        $broadcaster = new FamilySyncBroadcaster($memberships);

        $broadcaster->dispatch('family-1', FamilySyncEventType::FamilyCreated);

        Event::assertDispatched(FamilySyncUpdated::class, function (FamilySyncUpdated $event): bool {
            return $event->eventType === FamilySyncEventType::FamilyCreated;
        });
    }

    public function test_profile_updated_event_fires_after_successful_dispatch(): void
    {
        config(['broadcasting.default' => 'log']);
        Event::fake([FamilySyncUpdated::class]);

        $memberships = Mockery::mock(MembershipService::class);
        $broadcaster = new FamilySyncBroadcaster($memberships);

        $broadcaster->dispatch('family-1', FamilySyncEventType::ProfileUpdated);

        Event::assertDispatched(FamilySyncUpdated::class, function (FamilySyncUpdated $event): bool {
            return $event->eventType === FamilySyncEventType::ProfileUpdated;
        });
    }

    public function test_profile_updated_dispatches_to_each_membership_family(): void
    {
        config(['broadcasting.default' => 'log']);
        Event::fake([FamilySyncUpdated::class]);

        $memberships = Mockery::mock(MembershipService::class);
        $memberships->shouldReceive('listByUserId')
            ->once()
            ->with('user-1')
            ->andReturn([
                new \App\Data\MembershipData('m-1', 'family-a', 'user-1', 'member', '2026-08-07T00:00:00+00:00'),
            ]);

        $broadcaster = new FamilySyncBroadcaster($memberships);
        $broadcaster->dispatchForUserMemberships('user-1', FamilySyncEventType::ProfileUpdated);

        Event::assertDispatched(FamilySyncUpdated::class, function (FamilySyncUpdated $event): bool {
            return $event->eventType === FamilySyncEventType::ProfileUpdated
                && $event->familyId === 'family-a';
        });
    }
}
