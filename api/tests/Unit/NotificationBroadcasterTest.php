<?php

namespace Tests\Unit;

use App\Events\UserNotificationUpdated;
use App\Services\NotificationBroadcaster;
use App\Services\NotificationService;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class NotificationBroadcasterTest extends TestCase
{
    public function test_dispatch_emits_user_notification_event_when_enabled(): void
    {
        config(['broadcasting.default' => 'log']);
        Event::fake([UserNotificationUpdated::class]);

        $broadcaster = new NotificationBroadcaster;
        $broadcaster->dispatch('user-1', NotificationService::EVENT_CREATED, 'notif-1');

        Event::assertDispatched(UserNotificationUpdated::class, function (UserNotificationUpdated $event): bool {
            return $event->userId === 'user-1'
                && $event->notificationId === 'notif-1'
                && $event->broadcastAs() === 'notification.updated'
                && $event->broadcastOn() == [new PrivateChannel('user.user-1')];
        });
    }

    public function test_dispatch_skipped_when_broadcasting_disabled(): void
    {
        config(['broadcasting.default' => 'null']);
        Event::fake([UserNotificationUpdated::class]);

        $broadcaster = new NotificationBroadcaster;
        $broadcaster->dispatch('user-1', NotificationService::EVENT_CREATED);

        Event::assertNotDispatched(UserNotificationUpdated::class);
    }
}
