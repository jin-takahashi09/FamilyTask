<?php

namespace App\Services;

use App\Events\UserNotificationUpdated;
use DateTimeInterface;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Dispatches user-scoped notification events after successful Firestore writes.
 * Never puts notification bodies on family.sync channels.
 */
class NotificationBroadcaster
{
    public function dispatch(
        string $userId,
        string $eventType,
        ?string $notificationId = null,
        ?DateTimeInterface $updatedAt = null,
    ): void {
        if (! $this->isEnabled()) {
            return;
        }

        try {
            $event = new UserNotificationUpdated(
                $userId,
                $eventType,
                ($updatedAt ?? new \DateTimeImmutable)->format(DateTimeInterface::ATOM),
                $notificationId,
            );

            $pending = broadcast($event);

            if (request()->header('X-Socket-Id')) {
                $pending->toOthers();
            }

            unset($pending);
        } catch (Throwable $e) {
            Log::warning('User notification broadcast failed', [
                'userId' => $userId,
                'eventType' => $eventType,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);
        }
    }

    private function isEnabled(): bool
    {
        $default = config('broadcasting.default');

        return is_string($default) && $default !== '' && $default !== 'null';
    }
}
