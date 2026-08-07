<?php

namespace App\Services;

use App\Events\FamilySyncUpdated;
use DateTimeInterface;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Dispatches family-scoped sync events after successful Firestore writes.
 */
class FamilySyncBroadcaster
{
    public function __construct(
        private readonly MembershipService $memberships,
    ) {}

    public function dispatch(
        string $familyId,
        string $eventType,
        ?DateTimeInterface $updatedAt = null,
    ): void {
        if (! $this->isEnabled()) {
            return;
        }

        try {
            $event = new FamilySyncUpdated(
                $familyId,
                $eventType,
                ($updatedAt ?? new \DateTimeImmutable)->format(DateTimeInterface::ATOM),
            );

            $pending = broadcast($event);

            if (request()->header('X-Socket-Id')) {
                $pending->toOthers();
            }

            // PendingBroadcast sends in __destruct(); unset here so failures stay in try.
            unset($pending);
        } catch (Throwable $e) {
            Log::warning('Family sync broadcast failed', [
                'familyId' => $familyId,
                'eventType' => $eventType,
                'exceptionClass' => $e::class,
                'exceptionMessage' => $e->getMessage(),
            ]);
        }
    }

    public function dispatchForUserMemberships(
        string $userId,
        string $eventType,
        ?DateTimeInterface $updatedAt = null,
    ): void {
        $at = $updatedAt ?? new \DateTimeImmutable;

        foreach ($this->memberships->listByUserId($userId) as $membership) {
            $this->dispatch($membership->familyId, $eventType, $at);
        }
    }

    private function isEnabled(): bool
    {
        $default = config('broadcasting.default');

        return is_string($default) && $default !== '' && $default !== 'null';
    }
}
